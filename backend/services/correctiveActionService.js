const supabase = require("../src/config/supabase");

// =====================================================
// AICMS CORRECTIVE ACTION SERVICE
// =====================================================
//
// Responsibility:
// - Find existing corrective action by identity
// - Reuse OPEN action
// - Reuse IN_PROGRESS action
// - NEVER reopen COMPLETED action
// - NEVER create duplicate active action
// - If no action exists, create new OPEN action
// - Preserve completed corrective-action history
//
// Matching identity:
// project_id + activity_id + category + source_code
//
// ACTIVE STATES:
// - OPEN
// - IN_PROGRESS
//
// HISTORICAL STATE:
// - COMPLETED
//
// IMPORTANT:
// Every lookup creates a NEW Supabase query builder.
// This prevents query filters from leaking between lookups.
// =====================================================


// =====================================================
// BUILD CORRECTIVE ACTION QUERY
// =====================================================

function buildCorrectiveActionQuery({
  projectId,
  activityId,
  category,
  sourceCode
}) {
  let query = supabase
    .from("corrective_actions")
    .select("*")
    .eq("project_id", projectId)
    .eq("source_code", sourceCode)
    .eq("category", category);

  // ---------------------------------------------------
  // ACTIVITY MATCHING
  // ---------------------------------------------------

  if (
    activityId === null ||
    activityId === undefined
  ) {
    query = query.is(
      "activity_id",
      null
    );
  } else {
    query = query.eq(
      "activity_id",
      activityId
    );
  }

  return query;
}


// =====================================================
// CREATE / REUSE CORRECTIVE ACTION
// =====================================================

async function createOrReuseCorrectiveAction({
  projectId,
  activityId = null,
  category,
  title,
  description,
  priority = "HIGH",
  responsibleRole = "PROJECT_MANAGER",
  source = "DECISION_CONTROL",
  sourceCode,
  actionCodePrefix = "CA",
  dueDays = 3
}) {

  // ===================================================
  // VALIDATION
  // ===================================================

  if (
    projectId === null ||
    projectId === undefined ||
    !sourceCode
  ) {
    throw new Error(
      "projectId and sourceCode are required"
    );
  }

  if (!category) {
    throw new Error(
      "category is required"
    );
  }

  if (!title) {
    throw new Error(
      "title is required"
    );
  }


  // ===================================================
  // STEP 1
  // FIND OPEN ACTION
  // ===================================================

  const {
    data: openActions,
    error: openError
  } = await buildCorrectiveActionQuery({
    projectId,
    activityId,
    category,
    sourceCode
  })
    .eq(
      "status",
      "OPEN"
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    )
    .limit(1);

  if (openError) {
    throw new Error(
      "Failed to check OPEN corrective action: " +
      openError.message
    );
  }


  // ===================================================
  // OPEN ACTION FOUND
  // ===================================================

  if (
    openActions &&
    openActions.length > 0
  ) {
    const existingAction =
      openActions[0];

    return {
      action: existingAction,

      action_created: false,

      action_reused: true,

      action_status:
        existingAction.status,

      previous_status:
        existingAction.status,

      previous_action_id:
        existingAction.id,

      corrective_action_state:
        "ACTIVE"
    };
  }


  // ===================================================
  // STEP 2
  // FIND IN_PROGRESS ACTION
  // ===================================================

  const {
    data: inProgressActions,
    error: inProgressError
  } = await buildCorrectiveActionQuery({
    projectId,
    activityId,
    category,
    sourceCode
  })
    .eq(
      "status",
      "IN_PROGRESS"
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    )
    .limit(1);

  if (inProgressError) {
    throw new Error(
      "Failed to check IN_PROGRESS corrective action: " +
      inProgressError.message
    );
  }


  // ===================================================
  // IN_PROGRESS ACTION FOUND
  // ===================================================

  if (
    inProgressActions &&
    inProgressActions.length > 0
  ) {
    const existingAction =
      inProgressActions[0];

    return {
      action: existingAction,

      action_created: false,

      action_reused: true,

      action_status:
        existingAction.status,

      previous_status:
        existingAction.status,

      previous_action_id:
        existingAction.id,

      corrective_action_state:
        "ACTIVE"
    };
  }


  // ===================================================
  // STEP 3
  // FIND LATEST HISTORICAL ACTION
  // ===================================================

  const {
    data: historicalActions,
    error: historicalError
  } = await buildCorrectiveActionQuery({
    projectId,
    activityId,
    category,
    sourceCode
  })
    .order(
      "created_at",
      {
        ascending: false
      }
    )
    .limit(1);

  if (historicalError) {
    throw new Error(
      "Failed to check corrective action history: " +
      historicalError.message
    );
  }


  // ===================================================
  // COMPLETED ACTION FOUND
  //
  // IMPORTANT RULE:
  // NEVER reopen completed action.
  // NEVER modify completed action.
  //
  // If condition remains critical, Decision Control
  // remains critical and the completed record remains
  // historical.
  // ===================================================

  if (
    historicalActions &&
    historicalActions.length > 0
  ) {
    const existingAction =
      historicalActions[0];

    if (
      existingAction.status ===
      "COMPLETED"
    ) {
      return {
        action: existingAction,

        action_created: false,

        action_reused: false,

        action_status:
          "COMPLETED",

        previous_status:
          "COMPLETED",

        previous_action_id:
          existingAction.id,

        corrective_action_state:
          "COMPLETED_CONDITION_REMAINS"
      };
    }
  }


  // ===================================================
  // STEP 4
  // NO EXISTING ACTION
  //
  // Create a NEW OPEN corrective action.
  // ===================================================

  return await insertCorrectiveAction({
    projectId,
    activityId,
    category,
    title,
    description,
    priority,
    responsibleRole,
    source,
    sourceCode,
    actionCodePrefix,
    dueDays,
    previousActionId:
      historicalActions &&
      historicalActions.length > 0
        ? historicalActions[0].id
        : null
  });
}


// =====================================================
// INSERT NEW CORRECTIVE ACTION
// =====================================================

async function insertCorrectiveAction({
  projectId,
  activityId,
  category,
  title,
  description,
  priority,
  responsibleRole,
  source,
  sourceCode,
  actionCodePrefix,
  dueDays,
  previousActionId = null
}) {

  // ===================================================
  // SAFE DUE DAYS
  // ===================================================

  const numericDueDays =
    Number(dueDays);

  const safeDueDays =
    Number.isFinite(
      numericDueDays
    )
      ? numericDueDays
      : 3;


  // ===================================================
  // DUE DATE
  // ===================================================

  const dueDate =
    new Date(
      Date.now() +
      (
        safeDueDays *
        24 *
        60 *
        60 *
        1000
      )
    )
      .toISOString()
      .slice(
        0,
        10
      );


  // ===================================================
  // UNIQUE ACTION CODE
  // ===================================================

  const actionCode =
    actionCodePrefix +
    "-" +
    projectId +
    "-" +
    Date.now();


  // ===================================================
  // INSERT NEW OPEN ACTION
  // ===================================================

  const {
    data: createdAction,
    error: createError
  } = await supabase
    .from("corrective_actions")
    .insert({
      action_code:
        actionCode,

      project_id:
        projectId,

      activity_id:
        activityId,

      category:
        category,

      title:
        title,

      description:
        description,

      priority:
        priority,

      responsible_role:
        responsibleRole,

      source:
        source,

      source_code:
        sourceCode,

      due_date:
        dueDate,

      status:
        "OPEN"
    })
    .select()
    .single();


  // ===================================================
  // INSERT ERROR
  // ===================================================

  if (createError) {
    throw new Error(
      "Failed to create corrective action: " +
      createError.message
    );
  }


  // ===================================================
  // RETURN CREATED ACTION
  // ===================================================

  return {
    action:
      createdAction,

    action_created:
      true,

    action_reused:
      false,

    action_status:
      "OPEN",

    previous_status:
      null,

    previous_action_id:
      previousActionId,

    corrective_action_state:
      "NEW"
  };
}


// =====================================================
// EXPORT
// =====================================================

module.exports = {
  createOrReuseCorrectiveAction
};