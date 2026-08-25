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
//      ?
// Recommended Actions
//      ?
// Corrective Action
//      ?
// Owner / Priority / Due Date
//      ?
// OPEN ? IN_PROGRESS ? COMPLETED
//
// =====================================================


// =====================================================
// GET PROJECT CORRECTIVE ACTIONS
// =====================================================

router.get("/project/:projectId", async (req, res) => {

  try {

    const projectId =
      Number(req.params.projectId);

    if (
      !Number.isInteger(projectId) ||
      projectId <= 0
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
      .eq("project_id", projectId)
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

    return res.json({

      success: true,

      project_id:
        projectId,

      count:
        data.length,

      corrective_actions:
        data

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

});


// =====================================================
// GET SINGLE CORRECTIVE ACTION
// =====================================================

router.get("/:id", async (req, res) => {

  try {

    const actionId =
      Number(req.params.id);

    if (
      !Number.isInteger(actionId) ||
      actionId <= 0
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
      .eq("id", actionId)
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
        data

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

});


// =====================================================
// CREATE CORRECTIVE ACTION
// =====================================================

router.post("/", async (req, res) => {

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
    // VALIDATION
    // -------------------------------------------------

    const projectId =
      Number(project_id);

    if (
      !Number.isInteger(projectId) ||
      projectId <= 0
    ) {

      return res.status(400).json({
        success: false,
        message:
          "project_id must be a valid positive integer"
      });

    }

    if (
      !category ||
      !title
    ) {

      return res.status(400).json({
        success: false,
        message:
          "category and title are required"
      });

    }


    // -------------------------------------------------
    // GENERATE ACTION CODE
    // -------------------------------------------------

    const actionCode =
      `CA-${projectId}-${Date.now()}`;


    // -------------------------------------------------
    // INSERT
    // -------------------------------------------------

    const {
      data,
      error
    } = await supabase
      .from("corrective_actions")
      .insert({

        project_id:
          projectId,

        activity_id:
          activity_id
            ? Number(activity_id)
            : null,

        action_code:
          actionCode,

        category:
          category,

        title:
          title,

        description:
          description || null,

        priority:
          priority || "MEDIUM",

        status:
          "OPEN",

        responsible_role:
          responsible_role || null,

        responsible_user_id:
          responsible_user_id
            ? Number(responsible_user_id)
            : null,

        source:
          source || "MANUAL",

        source_code:
          source_code || null,

        due_date:
          due_date || null

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
        data

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

});


// =====================================================
// UPDATE CORRECTIVE ACTION
// =====================================================

router.put("/:id", async (req, res) => {

  try {

    const actionId =
      Number(req.params.id);

    if (
      !Number.isInteger(actionId) ||
      actionId <= 0
    ) {

      return res.status(400).json({
        success: false,
        message:
          "id must be a valid positive integer"
      });

    }


    const allowedFields = [

      
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


    const updateData = {};


    allowedFields.forEach(
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
    // STATUS VALIDATION
    // -------------------------------------------------

    const allowedStatuses = [
      "OPEN",
      "IN_PROGRESS",
      "COMPLETED"
    ];

    if (
      updateData.status !== undefined &&
      !allowedStatuses.includes(updateData.status)
    ) {

      return res.status(400).json({
        success: false,
        message:
          "status must be one of: OPEN, IN_PROGRESS, COMPLETED"
      });

    }


    // -------------------------------------------------
    // STATUS TRANSITION CONTROL
    // -------------------------------------------------

    let previousStatus = null
    let actionProjectId = null

    if (updateData.status !== undefined) {

      const {
        data: currentAction,
        error: currentActionError
      } = await supabase
        .from("corrective_actions")
        .select("status")
        .eq("id", actionId)
        .maybeSingle();


      if (currentActionError) {

        return res.status(500).json({
          success: false,
          message:
            "Failed to read current corrective action status",
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


      const currentStatus =
        currentAction.status;

      const newStatus =
        updateData.status;

      previousStatus =
        currentStatus;

      const {
        data: projectAction,
        error: projectActionError
      } = await supabase
        .from("corrective_actions")
        .select("project_id")
        .eq("id", actionId)
        .maybeSingle();

      if (projectActionError) {

        return res.status(500).json({
          success: false,
          message:
            "Failed to read corrective action project",
          error:
            projectActionError.message
        });

      }

      actionProjectId =
        projectAction
          ? projectAction.project_id
          : null;


      const validTransitions = {

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


      if (
        !validTransitions[currentStatus] ||
        !validTransitions[currentStatus].includes(newStatus)
      ) {

        return res.status(400).json({
          success: false,
          message:
            `Invalid status transition: ${currentStatus} -> ${newStatus}`
        });

      }

    }


    if (
      Object.keys(updateData).length ===
      0
    ) {

      return res.status(400).json({
        success: false,
        message:
          "No valid fields supplied for update"
      });

    }


    updateData.updated_at =
      new Date().toISOString();


    if (
      updateData.status ===
      "COMPLETED" &&
      !updateData.completed_date
    ) {

      updateData.completed_date =
        new Date()
          .toISOString()
          .slice(0, 10);

    }


    const {
      data,
      error
    } = await supabase
      .from("corrective_actions")
      .update(updateData)
      .eq("id", actionId)
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
      updateData.status !== undefined &&
      previousStatus !== null &&
      previousStatus !== data.status
    ) {

      const {
        error: historyError
      } = await supabase
        .from("corrective_action_history")
        .insert({

          corrective_action_id:
            data.id,

          project_id:
            actionProjectId,

          old_status:
            previousStatus,

          new_status:
            data.status,

          changed_by:
            data.responsible_user_id || null,

          changed_at:
            new Date().toISOString(),

          notes:
            `Status changed from ${previousStatus} to ${data.status}`

        });

      if (historyError) {

        console.error(
          "Corrective action history error:",
          historyError
        );

      }

    }


    return res.json({

      success: true,

      message:
        "Corrective action updated successfully",

      corrective_action:
        data

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

});


// =====================================================
// GET CORRECTIVE ACTION HISTORY
// =====================================================

router.get("/:id/history", async (req, res) => {

  try {

    const actionId =
      Number(req.params.id);

    if (
      !Number.isInteger(actionId) ||
      actionId <= 0
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
      .from("corrective_action_history")
      .select("*")
      .eq("corrective_action_id", actionId)
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

      count:
        data.length,

      history:
        data

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

});

// =====================================================
// DELETE CORRECTIVE ACTION
// =====================================================

router.delete("/:id", async (req, res) => {

  try {

    const actionId =
      Number(req.params.id);

    if (
      !Number.isInteger(actionId) ||
      actionId <= 0
    ) {

      return res.status(400).json({
        success: false,
        message:
          "id must be a valid positive integer"
      });

    }


    const {
      error
    } = await supabase
      .from("corrective_actions")
      .delete()
      .eq("id", actionId);


    if (error) {

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete corrective action",
        error:
          error.message
      });

    }


    return res.json({

      success: true,

      message:
        "Corrective action deleted successfully"

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

});


// =====================================================
// EXPORT
// =====================================================

module.exports = router;





