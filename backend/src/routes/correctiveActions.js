const express = require("express");

const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// AICMS CORRECTIVE ACTION CONTROL
// =====================================================
//
// Flow:
//
// Decision Control
//       ↓
// Recommended Actions
//       ↓
// Corrective Action
//       ↓
// Owner / Priority / Due Date
//       ↓
// OPEN → IN_PROGRESS → COMPLETED
//
// Overdue Control:
// OPEN / IN_PROGRESS + Due Date Passed
//       ↓
// Derived Lifecycle Status = OVERDUE
//
// IMPORTANT:
// OVERDUE is NOT stored as database status.
// Database status remains:
// OPEN / IN_PROGRESS / COMPLETED
//
// COMPLETED actions are NEVER marked overdue.
//
// =====================================================


// =====================================================
// CONSTANTS
// =====================================================

const ALLOWED_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED"
];

const VALID_TRANSITIONS = {
  OPEN: [
    "OPEN",
    "IN_PROGRESS",
    "COMPLETED"
  ],

  IN_PROGRESS: [
    "IN_PROGRESS",
    "COMPLETED"
  ],

  COMPLETED: [
    "COMPLETED"
  ]
};

const ALLOWED_PRIORITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL"
];

const ALLOWED_FIELDS = [
  "action_code",
  "category",
  "title",
  "description",
  "priority",
  "status",
  "responsible_role",
  "responsible_user_id",
  "due_date",
  "completed_date",
  "source",
  "source_code",
  "activity_id"
];


// =====================================================
// HELPER FUNCTIONS
// =====================================================

function isPositiveInteger(value) {
  return (
    Number.isInteger(value) &&
    value > 0
  );
}


function parseOptionalPositiveInteger(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  if (!isPositiveInteger(parsed)) {
    return {
      error: true
    };
  }

  return parsed;
}


// =====================================================
// OVERDUE CONTROL
// =====================================================
//
// This function calculates overdue status dynamically.
//
// Rules:
//
// 1. COMPLETED → never overdue
// 2. No due_date → not overdue
// 3. OPEN / IN_PROGRESS + due_date passed → OVERDUE
// 4. Due date today/future → original status
//
// No database update is performed here.
//
// =====================================================

function getCorrectiveActionLifecycle(action) {
  if (!action) {
    return {
      lifecycle_status: null,
      is_overdue: false,
      days_overdue: 0
    };
  }


  // -------------------------------------------------
  // COMPLETED ACTIONS ARE NEVER OVERDUE
  // -------------------------------------------------

  if (
    action.status === "COMPLETED"
  ) {
    return {
      lifecycle_status: "COMPLETED",
      is_overdue: false,
      days_overdue: 0
    };
  }


  // -------------------------------------------------
  // NO DUE DATE
  // -------------------------------------------------

  if (!action.due_date) {
    return {
      lifecycle_status:
        action.status,

      is_overdue: false,

      days_overdue: 0
    };
  }


  // -------------------------------------------------
  // TODAY - UTC DATE ONLY
  // -------------------------------------------------

  const today = new Date();

  const todayDate = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate()
    )
  );


  // -------------------------------------------------
  // DUE DATE
  // -------------------------------------------------

  const dueDate = new Date(
    String(action.due_date)
      .slice(0, 10) +
    "T00:00:00Z"
  );


  // -------------------------------------------------
  // INVALID DATE PROTECTION
  // -------------------------------------------------

  if (
    Number.isNaN(
      dueDate.getTime()
    )
  ) {
    return {
      lifecycle_status:
        action.status,

      is_overdue: false,

      days_overdue: 0
    };
  }


  // -------------------------------------------------
  // CALCULATE DAYS
  // -------------------------------------------------

  const difference =
    Math.floor(
      (
        todayDate.getTime() -
        dueDate.getTime()
      ) /
      (1000 * 60 * 60 * 24)
    );


  // -------------------------------------------------
  // OVERDUE
  // -------------------------------------------------

  if (difference > 0) {
    return {
      lifecycle_status: "OVERDUE",

      is_overdue: true,

      days_overdue: difference
    };
  }


  // -------------------------------------------------
  // NOT OVERDUE
  // -------------------------------------------------

  return {
    lifecycle_status:
      action.status,

    is_overdue: false,

    days_overdue: 0
  };
}


// =====================================================
// ADD LIFECYCLE INFORMATION
// =====================================================

function enrichCorrectiveAction(action) {
  if (!action) {
    return action;
  }

  const lifecycle =
    getCorrectiveActionLifecycle(
      action
    );

  return {
    ...action,

    lifecycle_status:
      lifecycle.lifecycle_status,

    is_overdue:
      lifecycle.is_overdue,

    days_overdue:
      lifecycle.days_overdue
  };
}


// =====================================================
// GET PROJECT CORRECTIVE ACTIONS
// GET /api/corrective-actions/project/:projectId
// =====================================================

router.get(
  "/project/:projectId",
  async (req, res) => {
    try {
      const projectId =
        Number(req.params.projectId);

      if (
        !isPositiveInteger(projectId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "projectId must be a valid positive integer"
        });
      }


      const {
        data,
        error
      } = await supabase
        .from("corrective_actions")
        .select("*")
        .eq(
          "project_id",
          projectId
        )
        .order("id", {
          ascending: false
        });


      if (error) {
        return res.status(500).json({
          success: false,
          message:
            "Failed to fetch corrective actions",
          error:
            error.message
        });
      }


      // -------------------------------------------------
      // ENRICH ACTIONS
      // -------------------------------------------------

      const correctiveActions =
        (data || []).map(
          (action) =>
            enrichCorrectiveAction(
              action
            )
        );


      // -------------------------------------------------
      // COUNTS
      // -------------------------------------------------

      const overdueActions =
        correctiveActions.filter(
          (action) =>
            action.is_overdue === true
        );

      const completedActions =
        correctiveActions.filter(
          (action) =>
            action.status ===
            "COMPLETED"
        );

      const openActions =
        correctiveActions.filter(
          (action) =>
            action.status ===
            "OPEN"
        );

      const inProgressActions =
        correctiveActions.filter(
          (action) =>
            action.status ===
            "IN_PROGRESS"
        );


      // -------------------------------------------------
      // RESPONSE
      // -------------------------------------------------

      return res.json({
        success: true,

        project_id:
          projectId,

        count:
          correctiveActions.length,

        overdue_count:
          overdueActions.length,

        completed_count:
          completedActions.length,

        open_count:
          openActions.length,

        in_progress_count:
          inProgressActions.length,

        corrective_actions:
          correctiveActions
      });

    } catch (error) {
      console.error(
        "Get corrective actions error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Corrective action server error",
        error:
          error.message
      });
    }
  }
);


// =====================================================
// GET OVERDUE CORRECTIVE ACTIONS
// GET /api/corrective-actions/overdue/project/:projectId
// =====================================================
//
// Returns only currently overdue actions.
//
// COMPLETED actions are automatically excluded.
//
// =====================================================

router.get(
  "/overdue/project/:projectId",
  async (req, res) => {
    try {
      const projectId =
        Number(req.params.projectId);

      if (
        !isPositiveInteger(projectId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "projectId must be a valid positive integer"
        });
      }


      const {
        data,
        error
      } = await supabase
        .from("corrective_actions")
        .select("*")
        .eq(
          "project_id",
          projectId
        )
        .in(
          "status",
          [
            "OPEN",
            "IN_PROGRESS"
          ]
        )
        .not(
          "due_date",
          "is",
          null
        )
        .order("due_date", {
          ascending: true
        });


      if (error) {
        return res.status(500).json({
          success: false,
          message:
            "Failed to fetch overdue corrective actions",
          error:
            error.message
        });
      }


      const overdueActions =
        (data || [])
          .map(
            (action) =>
              enrichCorrectiveAction(
                action
              )
          )
          .filter(
            (action) =>
              action.is_overdue === true
          );


      return res.json({
        success: true,

        project_id:
          projectId,

        count:
          overdueActions.length,

        overdue_count:
          overdueActions.length,

        corrective_actions:
          overdueActions
      });

    } catch (error) {
      console.error(
        "Get overdue corrective actions error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Corrective action overdue server error",
        error:
          error.message
      });
    }
  }
);


// =====================================================
// GET CORRECTIVE ACTION HISTORY
// GET /api/corrective-actions/:id/history
// IMPORTANT:
// THIS ROUTE MUST COME BEFORE /:id
// =====================================================

router.get(
  "/:id/history",
  async (req, res) => {
    try {
      const actionId =
        Number(req.params.id);

      if (
        !isPositiveInteger(actionId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "id must be a valid positive integer"
        });
      }


      // -------------------------------------------------
      // VERIFY ACTION EXISTS
      // -------------------------------------------------

      const {
        data: action,
        error: actionError
      } = await supabase
        .from("corrective_actions")
        .select(
          "id, project_id, action_code"
        )
        .eq(
          "id",
          actionId
        )
        .maybeSingle();


      if (actionError) {
        return res.status(500).json({
          success: false,
          message:
            "Failed to verify corrective action",
          error:
            actionError.message
        });
      }


      if (!action) {
        return res.status(404).json({
          success: false,
          message:
            "Corrective action not found"
        });
      }


      // -------------------------------------------------
      // GET HISTORY
      // -------------------------------------------------

      const {
        data,
        error
      } = await supabase
        .from(
          "corrective_action_history"
        )
        .select("*")
        .eq(
          "corrective_action_id",
          actionId
        )
        .order("id", {
          ascending: false
        });


      if (error) {
        return res.status(500).json({
          success: false,
          message:
            "Failed to fetch corrective action history",
          error:
            error.message
        });
      }


      return res.json({
        success: true,

        corrective_action_id:
          actionId,

        project_id:
          action.project_id,

        action_code:
          action.action_code,

        count:
          data
            ? data.length
            : 0,

        history:
          data || []
      });

    } catch (error) {
      console.error(
        "Get corrective action history error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Corrective action history server error",
        error:
          error.message
      });
    }
  }
);


// =====================================================
// GET SINGLE CORRECTIVE ACTION
// GET /api/corrective-actions/:id
// =====================================================

router.get(
  "/:id",
  async (req, res) => {
    try {
      const actionId =
        Number(req.params.id);

      if (
        !isPositiveInteger(actionId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "id must be a valid positive integer"
        });
      }


      const {
        data,
        error
      } = await supabase
        .from("corrective_actions")
        .select("*")
        .eq(
          "id",
          actionId
        )
        .maybeSingle();


      if (error) {
        return res.status(500).json({
          success: false,
          message:
            "Failed to fetch corrective action",
          error:
            error.message
        });
      }


      if (!data) {
        return res.status(404).json({
          success: false,
          message:
            "Corrective action not found"
        });
      }


      return res.json({
        success: true,

        corrective_action:
          enrichCorrectiveAction(
            data
          )
      });

    } catch (error) {
      console.error(
        "Get corrective action error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Corrective action server error",
        error:
          error.message
      });
    }
  }
);


// =====================================================
// CREATE CORRECTIVE ACTION
// POST /api/corrective-actions/
// =====================================================

router.post(
  "/",
  async (req, res) => {
    try {
      const {
        project_id,
        activity_id,
        category,
        title,
        description,
        priority,
        responsible_role,
        responsible_user_id,
        source,
        source_code,
        due_date
      } = req.body;


      // -------------------------------------------------
      // PROJECT VALIDATION
      // -------------------------------------------------

      const projectId =
        Number(project_id);

      if (
        !isPositiveInteger(
          projectId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "project_id must be a valid positive integer"
        });
      }


      // -------------------------------------------------
      // REQUIRED FIELDS
      // -------------------------------------------------

      if (
        typeof category !==
          "string" ||
        !category.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "category is required"
        });
      }


      if (
        typeof title !==
          "string" ||
        !title.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "title is required"
        });
      }


      // -------------------------------------------------
      // ACTIVITY VALIDATION
      // -------------------------------------------------

      const activityResult =
        parseOptionalPositiveInteger(
          activity_id
        );

      if (
        activityResult &&
        activityResult.error
      ) {
        return res.status(400).json({
          success: false,
          message:
            "activity_id must be a valid positive integer"
        });
      }


      const activityId =
        activityResult === null
          ? null
          : activityResult;


      // -------------------------------------------------
      // RESPONSIBLE USER VALIDATION
      // -------------------------------------------------

      const responsibleUserResult =
        parseOptionalPositiveInteger(
          responsible_user_id
        );

      if (
        responsibleUserResult &&
        responsibleUserResult.error
      ) {
        return res.status(400).json({
          success: false,
          message:
            "responsible_user_id must be a valid positive integer"
        });
      }


      const responsibleUserId =
        responsibleUserResult === null
          ? null
          : responsibleUserResult;


      // -------------------------------------------------
      // PRIORITY VALIDATION
      // -------------------------------------------------

      const finalPriority =
        priority || "MEDIUM";

      if (
        !ALLOWED_PRIORITIES.includes(
          finalPriority
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "priority must be one of: LOW, MEDIUM, HIGH, CRITICAL"
        });
      }


      // -------------------------------------------------
      // GENERATE ACTION CODE
      // -------------------------------------------------

      const actionCode =
        "CA-" +
        projectId +
        "-" +
        Date.now();


      // -------------------------------------------------
      // INSERT
      // -------------------------------------------------

      const {
        data,
        error
      } = await supabase
        .from(
          "corrective_actions"
        )
        .insert({
          project_id:
            projectId,

          activity_id:
            activityId,

          action_code:
            actionCode,

          category:
            category.trim(),

          title:
            title.trim(),

          description:
            description || null,

          priority:
            finalPriority,

          status:
            "OPEN",

          responsible_role:
            responsible_role ||
            null,

          responsible_user_id:
            responsibleUserId,

          source:
            source ||
            "MANUAL",

          source_code:
            source_code ||
            null,

          due_date:
            due_date ||
            null
        })
        .select()
        .single();


      if (error) {
        return res.status(500).json({
          success: false,
          message:
            "Failed to create corrective action",
          error:
            error.message
        });
      }


      return res.status(201).json({
        success: true,

        message:
          "Corrective action created successfully",

        corrective_action:
          enrichCorrectiveAction(
            data
          )
      });

    } catch (error) {
      console.error(
        "Create corrective action error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Corrective action server error",
        error:
          error.message
      });
    }
  }
);


// =====================================================
// UPDATE CORRECTIVE ACTION
// PUT /api/corrective-actions/:id
// =====================================================

router.put(
  "/:id",
  async (req, res) => {
    try {
      const actionId =
        Number(req.params.id);

      if (
        !isPositiveInteger(actionId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "id must be a valid positive integer"
        });
      }


      // -------------------------------------------------
      // BUILD UPDATE OBJECT
      // -------------------------------------------------

      const updateData = {};

      ALLOWED_FIELDS.forEach(
        (field) => {
          if (
            req.body[field] !==
            undefined
          ) {
            updateData[field] =
              req.body[field];
          }
        }
      );


      // -------------------------------------------------
      // NO VALID FIELDS
      // -------------------------------------------------

      if (
        Object.keys(
          updateData
        ).length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "No valid fields supplied for update"
        });
      }


      // -------------------------------------------------
      // GET CURRENT ACTION
      // -------------------------------------------------

      const {
        data: currentAction,
        error: currentActionError
      } = await supabase
        .from(
          "corrective_actions"
        )
        .select("*")
        .eq(
          "id",
          actionId
        )
        .maybeSingle();


      if (currentActionError) {
        return res.status(500).json({
          success: false,
          message:
            "Failed to read current corrective action",
          error:
            currentActionError.message
        });
      }


      if (!currentAction) {
        return res.status(404).json({
          success: false,
          message:
            "Corrective action not found"
        });
      }


      // -------------------------------------------------
      // STATUS VALIDATION
      // -------------------------------------------------

      if (
        updateData.status !==
        undefined
      ) {
        if (
          !ALLOWED_STATUSES.includes(
            updateData.status
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "status must be one of: OPEN, IN_PROGRESS, COMPLETED"
          });
        }


        const currentStatus =
          currentAction.status;

        const newStatus =
          updateData.status;

        const validNextStatuses =
          VALID_TRANSITIONS[
            currentStatus
          ];


        if (
          !validNextStatuses ||
          !validNextStatuses.includes(
            newStatus
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid status transition: " +
              currentStatus +
              " -> " +
              newStatus
          });
        }
      }


      // -------------------------------------------------
      // ACTIVITY VALIDATION
      // -------------------------------------------------

      if (
        updateData.activity_id !==
        undefined
      ) {
        const activityResult =
          parseOptionalPositiveInteger(
            updateData.activity_id
          );


        if (
          activityResult &&
          activityResult.error
        ) {
          return res.status(400).json({
            success: false,
            message:
              "activity_id must be a valid positive integer"
          });
        }


        updateData.activity_id =
          activityResult;
      }


      // -------------------------------------------------
      // RESPONSIBLE USER VALIDATION
      // -------------------------------------------------

      if (
        updateData.responsible_user_id !==
        undefined
      ) {
        const userResult =
          parseOptionalPositiveInteger(
            updateData.responsible_user_id
          );


        if (
          userResult &&
          userResult.error
        ) {
          return res.status(400).json({
            success: false,
            message:
              "responsible_user_id must be a valid positive integer"
          });
        }


        updateData.responsible_user_id =
          userResult;
      }


      // -------------------------------------------------
      // PRIORITY VALIDATION
      // -------------------------------------------------

      if (
        updateData.priority !==
        undefined
      ) {
        if (
          !ALLOWED_PRIORITIES.includes(
            updateData.priority
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "priority must be one of: LOW, MEDIUM, HIGH, CRITICAL"
          });
        }
      }


      // -------------------------------------------------
      // TITLE VALIDATION
      // -------------------------------------------------

      if (
        updateData.title !==
        undefined
      ) {
        if (
          typeof updateData.title !==
            "string" ||
          !updateData.title.trim()
        ) {
          return res.status(400).json({
            success: false,
            message:
              "title cannot be empty"
          });
        }


        updateData.title =
          updateData.title.trim();
      }


      // -------------------------------------------------
      // CATEGORY VALIDATION
      // -------------------------------------------------

      if (
        updateData.category !==
        undefined
      ) {
        if (
          typeof updateData.category !==
            "string" ||
          !updateData.category.trim()
        ) {
          return res.status(400).json({
            success: false,
            message:
              "category cannot be empty"
          });
        }


        updateData.category =
          updateData.category.trim();
      }


      // -------------------------------------------------
      // COMPLETED DATE CONTROL
      // -------------------------------------------------

      if (
        updateData.status ===
        "COMPLETED"
      ) {
        if (
          !updateData.completed_date
        ) {
          updateData.completed_date =
            new Date()
              .toISOString()
              .slice(0, 10);
        }
      }


      // -------------------------------------------------
      // UPDATED DATE
      // -------------------------------------------------

      updateData.updated_at =
        new Date().toISOString();


      // -------------------------------------------------
      // UPDATE DATABASE
      // -------------------------------------------------

      const {
        data,
        error
      } = await supabase
        .from(
          "corrective_actions"
        )
        .update(updateData)
        .eq(
          "id",
          actionId
        )
        .select()
        .single();


      if (error) {
        return res.status(500).json({
          success: false,
          message:
            "Failed to update corrective action",
          error:
            error.message
        });
      }


      // -------------------------------------------------
      // AUDIT HISTORY
      // -------------------------------------------------

      if (
        updateData.status !==
          undefined &&
        currentAction.status !==
          data.status
      ) {
        const {
          error: historyError
        } = await supabase
          .from(
            "corrective_action_history"
          )
          .insert({
            corrective_action_id:
              data.id,

            project_id:
              data.project_id,

            old_status:
              currentAction.status,

            new_status:
              data.status,

            changed_by:
              data.responsible_user_id ||
              null,

            changed_at:
              new Date().toISOString(),

            notes:
              "Status changed from " +
              currentAction.status +
              " to " +
              data.status
          });


        if (historyError) {
          console.error(
            "Corrective action history error:",
            historyError
          );
        }
      }


      // -------------------------------------------------
      // RESPONSE
      // -------------------------------------------------

      return res.json({
        success: true,

        message:
          "Corrective action updated successfully",

        corrective_action:
          enrichCorrectiveAction(
            data
          )
      });

    } catch (error) {
      console.error(
        "Update corrective action error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Corrective action server error",
        error:
          error.message
      });
    }
  }
);


// =====================================================
// DELETE CORRECTIVE ACTION
// DELETE /api/corrective-actions/:id
// =====================================================

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const actionId =
        Number(req.params.id);

      if (
        !isPositiveInteger(
          actionId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "id must be a valid positive integer"
        });
      }


      // -------------------------------------------------
      // CHECK EXISTENCE
      // -------------------------------------------------

      const {
        data: existingAction,
        error: existingError
      } = await supabase
        .from(
          "corrective_actions"
        )
        .select(
          "id, project_id, status, action_code"
        )
        .eq(
          "id",
          actionId
        )
        .maybeSingle();


      if (existingError) {
        return res.status(500).json({
          success: false,
          message:
            "Failed to verify corrective action",
          error:
            existingError.message
        });
      }


      if (!existingAction) {
        return res.status(404).json({
          success: false,
          message:
            "Corrective action not found"
        });
      }


      // -------------------------------------------------
      // PROTECT COMPLETED ACTION
      // -------------------------------------------------

      if (
        existingAction.status ===
        "COMPLETED"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Completed corrective actions cannot be deleted"
        });
      }


      // -------------------------------------------------
      // DELETE
      // -------------------------------------------------

      const {
        error
      } = await supabase
        .from(
          "corrective_actions"
        )
        .delete()
        .eq(
          "id",
          actionId
        );


      if (error) {
        return res.status(500).json({
          success: false,
          message:
            "Failed to delete corrective action",
          error:
            error.message
        });
      }


      // -------------------------------------------------
      // RESPONSE
      // -------------------------------------------------

      return res.json({
        success: true,

        message:
          "Corrective action deleted successfully",

        deleted_corrective_action_id:
          actionId
      });

    } catch (error) {
      console.error(
        "Delete corrective action error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Corrective action server error",
        error:
          error.message
      });
    }
  }
);


// =====================================================
// EXPORT
// =====================================================

module.exports = router;