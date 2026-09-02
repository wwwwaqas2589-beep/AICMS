const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

const {
  createOrReuseCorrectiveAction
} = require("../../services/correctiveActionService");


// =====================================================
// AICMS CENTRAL DECISION CONTROL
// =====================================================
//
// Project
//   â†“
// Project Control
//   â†“
// Activity Control
//   â†“
// EVM / Cost / Schedule / Productivity
//   â†“
// Alerts
//   â†“
// Central Decision Engine
//   â†“
// Management Decision
//   â†“
// Recommended Actions
//   â†“
// Automatic Corrective Actions
//
// IMPORTANT RULE
// -----------------------------------------------------
// Decision Control detects the condition.
//
// Corrective Action is a management record.
//
// COMPLETED corrective action:
// - MUST NOT be reopened
// - MUST NOT be duplicated while same condition remains
//
// OPEN / IN_PROGRESS:
// - Reuse existing action
//
// No existing action:
// - Create new OPEN action
//
// =====================================================


// =====================================================
// GET PROJECT DECISION CONTROL
// =====================================================

router.get("/:projectId", async (req, res) => {

  try {

    // ===================================================
    // VALIDATE PROJECT ID
    // ===================================================

    const projectId = Number(req.params.projectId);

    if (
      !Number.isInteger(projectId) ||
      projectId <= 0
    ) {

      return res.status(400).json({
        success: false,
        message: "projectId must be a valid positive integer"
      });

    }


    // ===================================================
    // GET PROJECT
    // ===================================================

    const {
      data: project,
      error: projectError
    } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();


    if (projectError) {

      return res.status(500).json({
        success: false,
        message: "Failed to fetch project",
        error: projectError.message
      });

    }


    if (!project) {

      return res.status(404).json({
        success: false,
        message: "Project not found"
      });

    }


    // ===================================================
    // GET ACTIVITIES
    // ===================================================

    const {
      data: activities,
      error: activitiesError
    } = await supabase
      .from("work_activities")
      .select("*")
      .eq("project_id", projectId)
      .order("id", {
        ascending: true
      });


    if (activitiesError) {

      return res.status(500).json({
        success: false,
        message: "Failed to fetch project activities",
        error: activitiesError.message
      });

    }


    // ===================================================
    // GET PRODUCTION
    // ===================================================

    const {
      data: production,
      error: productionError
    } = await supabase
      .from("daily_production")
      .select("*")
      .eq("project_id", projectId)
      .order("production_date", {
        ascending: false
      });


    if (productionError) {

      return res.status(500).json({
        success: false,
        message: "Failed to fetch project production",
        error: productionError.message
      });

    }


    // ===================================================
    // GET COSTS
    // ===================================================

    const {
      data: costs,
      error: costsError
    } = await supabase
      .from("daily_costs")
      .select("*")
      .eq("project_id", projectId)
      .order("cost_date", {
        ascending: false
      });


    if (costsError) {

      return res.status(500).json({
        success: false,
        message: "Failed to fetch project costs",
        error: costsError.message
      });

    }


    // ===================================================
    // GET PROJECT PLANNING BASELINE
    // ===================================================

    const {
      data: planning,
      error: planningError
    } = await supabase
      .from("project_planning")
      .select("*")
      .eq("project_id", projectId)
      .order("id", {
        ascending: true
      });


    if (planningError) {

      return res.status(500).json({
        success: false,
        message: "Failed to fetch planning baseline",
        error: planningError.message
      });

    }


    // ===================================================
    // PROJECT QUANTITY
    // ===================================================

    let plannedQuantity = 0;
    let completedQuantity = 0;

    (activities || []).forEach((activity) => {

      const planned = Number(activity.planned_quantity);

      const completed = Number(activity.completed_quantity);

      plannedQuantity += Number.isFinite(planned)
        ? planned
        : 0;

      completedQuantity += Number.isFinite(completed)
        ? completed
        : 0;

    });


    // ===================================================
    // ACTUAL PROJECT PROGRESS
    // ===================================================

    let actualProgress = 0;

    if (plannedQuantity > 0) {

      actualProgress =
        (completedQuantity / plannedQuantity) * 100;

    }

    actualProgress = Math.min(
      Math.max(
        Number(actualProgress) || 0,
        0
      ),
      100
    );


    // ===================================================
    // PROJECT BUDGET
    // ===================================================

    let budgetCost = 0;

    (activities || []).forEach((activity) => {

      const budgetValue =
        activity.budget_cost ??
        activity.planned_cost ??
        activity.total_budget ??
        0;

      const budget = Number(budgetValue);

      if (Number.isFinite(budget)) {
        budgetCost += budget;
      }

    });


    // ===================================================
    // ACTUAL COST
    // ===================================================

    let actualCost = 0;

    let manpowerCost = 0;

    let equipmentCost = 0;

    let materialCost = 0;


    (costs || []).forEach((item) => {

      const manpower =
        Number(item.manpower_cost || 0);

      const equipment =
        Number(item.equipment_cost || 0);

      const material =
        Number(item.material_cost || 0);


      if (Number.isFinite(manpower)) {
        manpowerCost += manpower;
      }

      if (Number.isFinite(equipment)) {
        equipmentCost += equipment;
      }

      if (Number.isFinite(material)) {
        materialCost += material;
      }


      const calculatedCost =
        (Number.isFinite(manpower) ? manpower : 0) +
        (Number.isFinite(equipment) ? equipment : 0) +
        (Number.isFinite(material) ? material : 0);


      const hasTotalCost =
        item.total_cost !== null &&
        item.total_cost !== undefined &&
        item.total_cost !== "";


      const rowTotalCost =
        hasTotalCost
          ? Number(item.total_cost)
          : calculatedCost;


      actualCost += Number.isFinite(rowTotalCost)
        ? rowTotalCost
        : calculatedCost;

    });


    // ===================================================
    // EARNED VALUE
    // ===================================================

    const budgetRatePerUnit =
      plannedQuantity > 0
        ? budgetCost / plannedQuantity
        : 0;


    const earnedValue =
      budgetRatePerUnit * completedQuantity;


    // ===================================================
    // PROJECT BASELINE
    // ===================================================

    let plannedProgress = 0;

    let baselineStartDate = null;

    let baselineFinishDate = null;


    // ===================================================
    // FIND VALID BASELINE DATES
    // ===================================================

    if (
      planning &&
      planning.length > 0
    ) {

      const validActivityIds =
        new Set(
          (activities || []).map(
            (activity) => Number(activity.id)
          )
        );


      const validPlanning =
        planning.filter((item) => {

          const activityId =
            Number(item.activity_id);

          const hasStartDate =
            item.baseline_start_date ||
            item.start_date;

          return (
            validActivityIds.has(activityId) &&
            Boolean(hasStartDate)
          );

        });


      if (validPlanning.length > 0) {

        const startDates =
          validPlanning
            .map(
              (item) =>
                item.baseline_start_date ||
                item.start_date
            )
            .filter(Boolean)
            .sort();


        const finishDates =
          validPlanning
            .map(
              (item) =>
                item.baseline_finish_date ||
                item.finish_date
            )
            .filter(Boolean)
            .sort();


        if (startDates.length > 0) {
          baselineStartDate = startDates[0];
        }


        if (finishDates.length > 0) {
          baselineFinishDate =
            finishDates[finishDates.length - 1];
        }

      }

    }


    // ===================================================
    // CALCULATE BASELINE PLANNED PROGRESS
    // ===================================================

    if (
      baselineStartDate &&
      baselineFinishDate
    ) {

      const today = new Date();

      const todayString =
        today.toISOString().slice(0, 10);


      const start =
        new Date(
          String(baselineStartDate) + "T00:00:00"
        );


      const finish =
        new Date(
          String(baselineFinishDate) + "T00:00:00"
        );


      const current =
        new Date(
          String(todayString) + "T00:00:00"
        );


      const totalDuration =
        finish.getTime() - start.getTime();


      if (totalDuration > 0) {

        const elapsedDuration =
          current.getTime() - start.getTime();


        plannedProgress =
          (elapsedDuration / totalDuration) * 100;

      }

      else if (
        current.getTime() >= finish.getTime()
      ) {

        plannedProgress = 100;

      }

      else {

        plannedProgress = 0;

      }

    }


    // ===================================================
    // WBS PLANNED PROGRESS FALLBACK
    // ===================================================

    if (
      plannedProgress <= 0 &&
      planning &&
      planning.length > 0
    ) {

      const plannedProgressValues =
        planning
          .map((item) => {

            if (
              item.planned_progress !== null &&
              item.planned_progress !== undefined &&
              item.planned_progress !== ""
            ) {

              const value =
                Number(item.planned_progress);

              return Number.isFinite(value)
                ? value
                : null;

            }

            return null;

          })
          .filter(
            (value) => value !== null
          );


      if (
        plannedProgressValues.length > 0
      ) {

        plannedProgress =
          plannedProgressValues.reduce(
            (sum, value) => sum + value,
            0
          ) /
          plannedProgressValues.length;

      }

    }


    // ===================================================
    // PROJECT FALLBACK
    // ===================================================

    if (
      plannedProgress <= 0 &&
      project.planned_progress !== null &&
      project.planned_progress !== undefined &&
      project.planned_progress !== ""
    ) {

      const projectProgress =
        Number(project.planned_progress);

      if (Number.isFinite(projectProgress)) {
        plannedProgress = projectProgress;
      }

    }


    plannedProgress =
      Math.min(
        Math.max(
          Number(plannedProgress) || 0,
          0
        ),
        100
      );


    // ===================================================
    // PLANNED VALUE
    // ===================================================

    const plannedValue =
      budgetCost *
      (plannedProgress / 100);


    // ===================================================
    // EVM
    // ===================================================

    const costVariance =
      earnedValue - actualCost;


    const scheduleVariance =
      earnedValue - plannedValue;


    const cpi =
      actualCost > 0
        ? earnedValue / actualCost
        : 0;


    const spi =
      plannedValue > 0
        ? earnedValue / plannedValue
        : 0;


    // ===================================================
    // FORECAST
    // ===================================================

    let eac = 0;

    let etc = 0;

    let vac = 0;

    let tcpi = 0;


    if (cpi > 0) {

      eac =
        budgetCost / cpi;


      etc =
        Math.max(
          eac - actualCost,
          0
        );


      vac =
        budgetCost - eac;

    }


    // ===================================================
    // TCPI
    // ===================================================

    const budgetRemaining =
      budgetCost - actualCost;


    if (budgetRemaining > 0) {

      tcpi =
        (
          budgetCost - earnedValue
        ) /
        budgetRemaining;

    }


    // ===================================================
    // SCHEDULE STATUS
    // ===================================================

    let scheduleStatus =
      "ON_SCHEDULE";


    if (
      actualProgress < plannedProgress
    ) {

      scheduleStatus =
        "BEHIND";

    }

    else if (
      actualProgress > plannedProgress
    ) {

      scheduleStatus =
        "AHEAD";

    }


    // ===================================================
    // COST STATUS
    // ===================================================

    let costStatus =
      "ON_BUDGET";


    if (costVariance < 0) {

      costStatus =
        "OVER_BUDGET";

    }

    else if (costVariance > 0) {

      costStatus =
        "UNDER_BUDGET";

    }


    // ===================================================
    // DECISION FLAGS
    // ===================================================

    const flags = [];


    // ===================================================
    // COST ALERT
    // ===================================================

    if (
      costStatus === "OVER_BUDGET"
    ) {

      flags.push({

        category: "COST",

        severity: "CRITICAL",

        code: "PROJECT_OVER_BUDGET",

        message:
          "Actual project cost is above earned-value budget."

      });

    }


    // ===================================================
    // CPI ALERT
    // ===================================================

    if (
      cpi > 0 &&
      cpi < 0.90
    ) {

      flags.push({

        category: "COST",

        severity: "CRITICAL",

        code: "LOW_CPI",

        message:
          "Project CPI is below the acceptable threshold of 0.90."

      });

    }


    // ===================================================
    // SPI ALERT
    // ===================================================

    if (
      spi > 0 &&
      spi < 0.90
    ) {

      flags.push({

        category: "SCHEDULE",

        severity: "CRITICAL",

        code: "LOW_SPI",

        message:
          "Project SPI is below the acceptable threshold of 0.90."

      });

    }


    // ===================================================
    // PROJECT BEHIND ALERT
    // ===================================================

    if (
      scheduleStatus === "BEHIND"
    ) {

      flags.push({

        category: "SCHEDULE",

        severity: "CRITICAL",

        code: "PROJECT_BEHIND",

        message:
          "Actual project progress is behind planned progress."

      });

    }


    // ===================================================
    // EAC ALERT
    // ===================================================

    if (
      eac > 0 &&
      budgetCost > 0 &&
      eac > budgetCost
    ) {

      flags.push({

        category: "FORECAST",

        severity: "CRITICAL",

        code: "EAC_OVERRUN",

        message:
          "Forecast final project cost exceeds approved budget.",

        forecast_overrun:
          Number(
            (eac - budgetCost).toFixed(2)
          )

      });

    }


    // ===================================================
    // TCPI ALERT
    // ===================================================

    if (
      tcpi > 1.20
    ) {

      flags.push({

        category: "FORECAST",

        severity: "CRITICAL",

        code: "HIGH_TCPI",

        message:
          "Required future cost efficiency is significantly above 1.20."

      });

    }


    // ===================================================
    // ACTIVITY RISK ANALYSIS
    // ===================================================

    const criticalActivities = [];


    (activities || []).forEach((activity) => {

      const planned =
        Number(
          activity.planned_quantity || 0
        );


      const completed =
        Number(
          activity.completed_quantity || 0
        );


      const budget =
        Number(
          activity.budget_cost ??
          activity.planned_cost ??
          activity.total_budget ??
          0
        );


      let progress = 0;


      if (planned > 0) {

        progress =
          (completed / planned) * 100;

      }


      progress =
        Math.min(
          Math.max(
            Number(progress) || 0,
            0
          ),
          100
        );


      // =================================================
      // ACTIVITY BASELINE PROGRESS
      // =================================================

      let plannedActivityProgress = 0;


      const activityPlanning =
        (planning || []).filter(
          (item) =>
            Number(item.activity_id) ===
            Number(activity.id)
        );


      let activityStartDate = null;

      let activityFinishDate = null;


      if (
        activityPlanning.length > 0
      ) {

        const startDates =
          activityPlanning
            .map(
              (item) =>
                item.baseline_start_date ||
                item.start_date
            )
            .filter(Boolean)
            .sort();


        const finishDates =
          activityPlanning
            .map(
              (item) =>
                item.baseline_finish_date ||
                item.finish_date
            )
            .filter(Boolean)
            .sort();


        if (startDates.length > 0) {
          activityStartDate = startDates[0];
        }


        if (finishDates.length > 0) {
          activityFinishDate =
            finishDates[finishDates.length - 1];
        }

      }


      // =================================================
      // ACTIVITY BASELINE DATE CALCULATION
      // =================================================

      if (
        activityStartDate &&
        activityFinishDate
      ) {

        const today = new Date();

        const todayString =
          today.toISOString().slice(0, 10);


        const start =
          new Date(
            String(activityStartDate) + "T00:00:00"
          );


        const finish =
          new Date(
            String(activityFinishDate) + "T00:00:00"
          );


        const current =
          new Date(
            String(todayString) + "T00:00:00"
          );


        const totalDuration =
          finish.getTime() - start.getTime();


        if (totalDuration > 0) {

          const elapsedDuration =
            current.getTime() - start.getTime();


          plannedActivityProgress =
            (elapsedDuration / totalDuration) * 100;

        }

        else if (
          current.getTime() >= finish.getTime()
        ) {

          plannedActivityProgress = 100;

        }

        else {

          plannedActivityProgress = 0;

        }

      }

      else {

        plannedActivityProgress =
          Number(
            activity.planned_progress ??
            activity.progress_percent ??
            0
          );

      }


      plannedActivityProgress =
        Math.min(
          Math.max(
            Number(plannedActivityProgress) || 0,
            0
          ),
          100
        );


      // =================================================
      // CRITICAL ACTIVITY
      // =================================================

      if (
        progress < plannedActivityProgress
      ) {

        criticalActivities.push({

          id:
            activity.id,

          activity_code:
            activity.activity_code,

          activity_name:
            activity.activity_name,

          planned_progress:
            Number(
              plannedActivityProgress.toFixed(2)
            ),

          actual_progress:
            Number(
              progress.toFixed(2)
            ),

          progress_variance:
            Number(
              (
                progress -
                plannedActivityProgress
              ).toFixed(2)
            ),

          budget_cost:
            Number(
              (
                Number.isFinite(budget)
                  ? budget
                  : 0
              ).toFixed(2)
            ),

          status:
            "BEHIND"

        });

      }

    });


    // ===================================================
    // MANAGEMENT DECISION
    // ===================================================

    let decision =
      "NO_ACTION_REQUIRED";


    let priority =
      "LOW";


    let overallStatus =
      "NORMAL";


    const actions = [];


    // ===================================================
    // CRITICAL COST
    // ===================================================

    if (
      costStatus === "OVER_BUDGET" ||
      (
        cpi > 0 &&
        cpi < 0.90
      )
    ) {

      overallStatus =
        "CRITICAL";


      priority =
        "HIGH";


      decision =
        "IMMEDIATE_COST_CONTROL_REQUIRED";


      actions.push(
        "Investigate project cost overrun"
      );


      actions.push(
        "Review manpower cost"
      );


      actions.push(
        "Review equipment cost"
      );


      actions.push(
        "Review material cost"
      );

    }


    // ===================================================
    // FORECAST
    // ===================================================

    if (
      eac > budgetCost &&
      budgetCost > 0
    ) {

      overallStatus =
        "CRITICAL";


      priority =
        "HIGH";


      actions.push(
        "Review forecast final cost"
      );


      actions.push(
        "Prepare corrective cost-control plan"
      );

    }


    // ===================================================
    // SCHEDULE
    // ===================================================

    if (
      scheduleStatus === "BEHIND" ||
      (
        spi > 0 &&
        spi < 0.90
      )
    ) {

      overallStatus =
        "CRITICAL";


      priority =
        "HIGH";


      decision =
        "PROJECT_SCHEDULE_RECOVERY_REQUIRED";


      actions.push(
        "Prepare schedule recovery plan"
      );


      actions.push(
        "Review manpower deployment"
      );


      actions.push(
        "Review equipment deployment"
      );

    }


    // ===================================================
    // TCPI
    // ===================================================

    if (
      tcpi > 1.20
    ) {

      overallStatus =
        "CRITICAL";


      priority =
        "HIGH";


      actions.push(
        "Improve future cost efficiency"
      );

    }


    // ===================================================
    // CRITICAL ACTIVITIES
    // ===================================================

    if (
      criticalActivities.length > 0
    ) {

      actions.push(
        "Review critical activities immediately"
      );

    }


    // ===================================================
    // GENERAL CRITICAL
    // ===================================================

    if (
      overallStatus === "NORMAL" &&
      flags.some(
        (flag) =>
          flag.severity === "CRITICAL"
      )
    ) {

      overallStatus =
        "CRITICAL";


      priority =
        "HIGH";


      decision =
        "IMMEDIATE_PROJECT_MANAGEMENT_ACTION_REQUIRED";

    }


    // ===================================================
    // WARNING
    // ===================================================

    if (
      overallStatus === "NORMAL" &&
      flags.length > 0
    ) {

      overallStatus =
        "WARNING";


      priority =
        "MEDIUM";


      decision =
        "PROJECT_MANAGEMENT_REVIEW_REQUIRED";

    }


    // ===================================================
    // UNIQUE ACTIONS
    // ===================================================

    const uniqueActions =
      [...new Set(actions)];


    // ===================================================
    // AUTOMATIC SCHEDULE CORRECTIVE ACTION
    // ===================================================

    let automaticCorrectiveAction = null;


    if (
      overallStatus === "CRITICAL" &&
      decision === "PROJECT_SCHEDULE_RECOVERY_REQUIRED"
    ) {

      const criticalActivity =
        criticalActivities.length > 0
          ? criticalActivities[0]
          : null;


      try {

        const correctiveResult =
          await createOrReuseCorrectiveAction({

            projectId,

            activityId:
              criticalActivity
                ? criticalActivity.id
                : null,

            category:
              "SCHEDULE",

            title:
              "Recover Project Schedule",

            description:
              criticalActivity
                ? "Project schedule is behind baseline. Activity " + criticalActivity.activity_name + " requires recovery action."
                : "Project schedule is behind the approved baseline and requires recovery action.",

            priority,

            responsibleRole:
              "PROJECT_MANAGER",

            source:
              "DECISION_CONTROL",

            sourceCode:
              "PROJECT_SCHEDULE_RECOVERY_REQUIRED",

            actionCodePrefix:
              "CA",

            dueDays:
              3

          });


        automaticCorrectiveAction =
          correctiveResult?.action || null;


      }

      catch (correctiveActionError) {

        console.error(
          "Automatic schedule corrective action error:",
          correctiveActionError
        );

      }

    }


    // ===================================================
    // AUTOMATIC COST CORRECTIVE ACTION
    // ===================================================

    let automaticCostCorrectiveAction = null;


    const costControlRequired =
      costStatus === "OVER_BUDGET" ||
      (
        cpi > 0 &&
        cpi < 0.90
      ) ||
      (
        eac > budgetCost &&
        budgetCost > 0
      );


    if (
      overallStatus === "CRITICAL" &&
      costControlRequired
    ) {

      try {

        const costCorrectiveResult =
          await createOrReuseCorrectiveAction({

            projectId,

            activityId:
              null,

            category:
              "COST",

            title:
              "Control Project Cost",

            description:
              "Project cost performance is critical. Review manpower, equipment, material costs and forecast final cost.",

            priority,

            responsibleRole:
              "PROJECT_MANAGER",

            source:
              "DECISION_CONTROL",

            sourceCode:
              "PROJECT_COST_CONTROL_REQUIRED",

            actionCodePrefix:
              "CA-COST",

            dueDays:
              3

          });


        automaticCostCorrectiveAction =
          costCorrectiveResult?.action || null;


      }

      catch (costActionError) {

        console.error(
          "Automatic cost corrective action error:",
          costActionError
        );

      }

    }


    // ===================================================
    // RESPONSE
    // ===================================================

    return res.json({

      success: true,


      // =================================================
      // DECISION CONTROL
      // =================================================

      decision_control: {

        status:
          overallStatus,

        priority:
          priority,

        decision:
          decision,

        project_id:
          projectId,

        project_code:
          project.project_code,

        project_name:
          project.project_name ||
          project.name

      },


      // =================================================
      // INDICATORS
      // =================================================

      indicators: {

        planned_progress:
          Number(
            plannedProgress.toFixed(2)
          ),

        actual_progress:
          Number(
            actualProgress.toFixed(2)
          ),

        progress_variance:
          Number(
            (
              actualProgress -
              plannedProgress
            ).toFixed(2)
          ),

        cost_status:
          costStatus,

        schedule_status:
          scheduleStatus,

        budget_cost:
          Number(
            budgetCost.toFixed(2)
          ),

        actual_cost:
          Number(
            actualCost.toFixed(2)
          ),

        earned_value:
          Number(
            earnedValue.toFixed(2)
          )

      },


      // =================================================
      // EVM
      // =================================================

      evm: {

        bac:
          Number(
            budgetCost.toFixed(2)
          ),

        pv:
          Number(
            plannedValue.toFixed(2)
          ),

        ev:
          Number(
            earnedValue.toFixed(2)
          ),

        ac:
          Number(
            actualCost.toFixed(2)
          ),

        cv:
          Number(
            costVariance.toFixed(2)
          ),

        sv:
          Number(
            scheduleVariance.toFixed(2)
          ),

        cpi:
          Number(
            cpi.toFixed(3)
          ),

        spi:
          Number(
            spi.toFixed(3)
          ),

        eac:
          Number(
            eac.toFixed(2)
          ),

        etc:
          Number(
            etc.toFixed(2)
          ),

        vac:
          Number(
            vac.toFixed(2)
          ),

        tcpi:
          Number(
            tcpi.toFixed(3)
          )

      },


      // =================================================
      // ALERTS
      // =================================================

      alerts: {

        total:
          flags.length,

        critical:
          flags.filter(
            (flag) =>
              flag.severity === "CRITICAL"
          ).length,

        warnings:
          flags.filter(
            (flag) =>
              flag.severity === "WARNING"
          ).length,

        items:
          flags

      },


      // =================================================
      // CRITICAL ACTIVITIES
      // =================================================

      critical_activities:
        criticalActivities,


      // =================================================
      // RECOMMENDED ACTIONS
      // =================================================

      recommended_actions:
        uniqueActions,


      // =================================================
      // AUTOMATIC SCHEDULE CORRECTIVE ACTION
      // =================================================

      automatic_corrective_action:
        automaticCorrectiveAction,


      // =================================================
      // AUTOMATIC COST CORRECTIVE ACTION
      // =================================================

      automatic_cost_corrective_action:
        automaticCostCorrectiveAction,


      // =================================================
      // RESOURCE COSTS
      // =================================================

      resource_costs: {

        manpower_cost:
          Number(
            manpowerCost.toFixed(2)
          ),

        equipment_cost:
          Number(
            equipmentCost.toFixed(2)
          ),

        material_cost:
          Number(
            materialCost.toFixed(2)
          )

      },


      // =================================================
      // RECORD COUNTS
      // =================================================

      records: {

        activity_count:
          (activities || []).length,

        production_records:
          (production || []).length,

        cost_records:
          (costs || []).length

      }

    });

  }

  catch (error) {

    console.error(
      "Decision Control Error:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Decision Control failed",

      error:
        error.message

    });

  }

});


module.exports = router;
