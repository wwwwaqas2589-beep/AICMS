const express = require("express");

const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// PROJECT HEALTH CONTROL
// =====================================================
//
// Management-level consolidated project health.
//
// Flow:
//
// Project
//   ↓
// WBS / Planning Baseline
//   ↓
// Activities
//   ↓
// Production
//   ↓
// Costs
//   ↓
// Progress
//   ↓
// EVM
//   ↓
// Alerts
//   ↓
// Decision
//
// =====================================================

router.get("/:projectId", async (req, res) => {
  try {

    // =================================================
    // PROJECT ID
    // =================================================

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

    // =================================================
    // PROJECT
    // =================================================

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
        message:
          "Failed to fetch project",
        error:
          projectError.message
      });
    }

    if (!project) {
      return res.status(404).json({
        success: false,
        message:
          "Project not found"
      });
    }

    // =================================================
    // ACTIVITIES
    // =================================================

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
        message:
          "Failed to fetch activities",
        error:
          activitiesError.message
      });
    }

    // =================================================
    // PRODUCTION
    // =================================================

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
        message:
          "Failed to fetch production",
        error:
          productionError.message
      });
    }

    // =================================================
    // COSTS
    // =================================================

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
        message:
          "Failed to fetch costs",
        error:
          costsError.message
      });
    }

    // =================================================
    // PROJECT TOTALS
    // =================================================

    let plannedQuantity = 0;
    let completedQuantity = 0;
    let budgetCost = 0;

    activities.forEach((activity) => {

      plannedQuantity += Number(
        activity.planned_quantity || 0
      );

      completedQuantity += Number(
        activity.completed_quantity || 0
      );

      budgetCost += Number(
        activity.budget_cost ||
        activity.planned_cost ||
        activity.total_budget ||
        0
      );

    });

    // =================================================
    // ACTUAL PROGRESS
    // =================================================

    let actualProgress = 0;

    if (plannedQuantity > 0) {

      actualProgress =
        (
          completedQuantity /
          plannedQuantity
        ) * 100;
    }

    actualProgress =
      Math.min(
        Math.max(
          actualProgress,
          0
        ),
        100
      );

    // =================================================
    // BASELINE / PLANNED PROGRESS
    // =================================================

    let plannedProgress = 0;

    let baselineStartDate = null;

    let baselineFinishDate = null;

    // -------------------------------------------------
// PROJECT EXPLICIT PLANNED PROGRESS
// -------------------------------------------------
// Project-level planned_progress is a FALLBACK.
// Valid baseline dates must have priority.
// -------------------------------------------------

// Do not set plannedProgress here.
// Baseline calculation will run first.

// -------------------------------------------------
// LOAD WBS PLANNING
    // -------------------------------------------------

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
        message:
          "Failed to fetch planning baseline",
        error:
          planningError.message
      });
    }

    // -------------------------------------------------
    // FIND BASELINE DATES
    // -------------------------------------------------

    if (
      planning &&
      planning.length > 0
    ) {

      const validActivityIds =
        new Set(
          activities.map(
            (activity) =>
              Number(activity.id)
          )
        );

      const validPlanning =
        (planning || []).filter(
          (item) =>
            validActivityIds.has(
              Number(item.activity_id)
            ) &&
            (
              item.baseline_start_date ||
              item.start_date
            )
        );

      if (
        validPlanning.length > 0
      ) {

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

        if (
          startDates.length > 0
        ) {

          baselineStartDate =
            startDates[0];
        }

        if (
          finishDates.length > 0
        ) {

          baselineFinishDate =
            finishDates[
              finishDates.length - 1
            ];
        }
      }
    }

    // -------------------------------------------------
// CALCULATE PLANNED PROGRESS
// -------------------------------------------------
// Priority:
// 1. Valid baseline dates
// 2. Valid planning planned_progress
// 3. Activity fallback
// 4. Project fallback
// -------------------------------------------------

// -------------------------------------------------
// BASELINE DATE CALCULATION
// -------------------------------------------------

if (
  baselineStartDate &&
  baselineFinishDate
) {

  const today =
    new Date();

  const start =
    new Date(
      `${baselineStartDate}T00:00:00`
    );

  const finish =
    new Date(
      `${baselineFinishDate}T00:00:00`
    );

  const current =
    new Date(
      `${today
        .toISOString()
        .slice(0, 10)}T00:00:00`
    );

  const totalDuration =
    finish.getTime() -
    start.getTime();

  if (
    totalDuration > 0
  ) {

    const elapsedDuration =
      current.getTime() -
      start.getTime();

    plannedProgress =
      (
        elapsedDuration /
        totalDuration
      ) * 100;

  } else if (
    current.getTime() >=
    finish.getTime()
  ) {

    plannedProgress = 100;

  } else {

    plannedProgress = 0;
  }

  plannedProgress =
    Math.min(
      Math.max(
        plannedProgress,
        0
      ),
      100
    );
}



// -------------------------------------------------
// FALLBACK TO WBS PLANNED PROGRESS
    // -------------------------------------------------

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
                Number(
                  item.planned_progress
                );

              return Number.isFinite(
                value
              )
                ? value
                : null;
            }

            return null;
          })
          .filter(
            (value) =>
              value !== null
          );

      if (
        plannedProgressValues.length > 0
      ) {

        plannedProgress =
          plannedProgressValues.reduce(
            (sum, value) =>
              sum + value,
            0
          ) /
          plannedProgressValues.length;
      }
    }

    // -------------------------------------------------
    // FINAL PLANNED PROGRESS FALLBACK
    // -------------------------------------------------

    if (
      plannedProgress <= 0 &&
      activities.length > 0
    ) {

      const activityProgressValues =
        activities
          .map((activity) => {

            const value =
              Number(
                activity.planned_progress ||
                activity.progress_percent ||
                0
              );

            return Number.isFinite(
              value
            )
              ? value
              : 0;
          });

      if (
        activityProgressValues.length > 0
      ) {

        plannedProgress =
          activityProgressValues.reduce(
            (sum, value) =>
              sum + value,
            0
          ) /
          activityProgressValues.length;
      }
    }

    plannedProgress =
      Math.min(
        Math.max(
          plannedProgress,
          0
        ),
        100
      );

    // =================================================
    // PROGRESS VARIANCE
    // =================================================

    const progressVariance =
      actualProgress -
      plannedProgress;

    
    // =================================================
    // SCHEDULE STATUS
    // =================================================

    let scheduleStatus =
      "ON_SCHEDULE";

    if (
      progressVariance < 0
    ) {

      scheduleStatus =
        "BEHIND";

    } else if (
      progressVariance > 0
    ) {

      scheduleStatus =
        "AHEAD";
    }

// =================================================
    // PRODUCTION
    // =================================================

    let totalProduction = 0;

    let totalManpower = 0;

    let totalEquipment = 0;

    let totalWorkingHours = 0;

    production.forEach((item) => {

      totalProduction += Number(
        item.today_quantity || 0
      );

      totalManpower += Number(
        item.manpower || 0
      );

      totalEquipment += Number(
        item.equipment || 0
      );

      totalWorkingHours += Number(
        item.working_hours || 0
      );

    });

    // =================================================
    // PRODUCTIVITY
    // =================================================

    const productivityPerHour =
      totalWorkingHours > 0
        ? totalProduction /
          totalWorkingHours
        : 0;

    const totalManHours =
      totalManpower *
      totalWorkingHours;

    const productivityPerManHour =
      totalManHours > 0
        ? totalProduction /
          totalManHours
        : 0;

    // =================================================
    // COST TOTALS
    // =================================================

    let manpowerCost = 0;

    let equipmentCost = 0;

    let materialCost = 0;

    let actualCost = 0;

    costs.forEach((item) => {

      const itemManpowerCost =
        Number(
          item.manpower_cost || 0
        );

      const itemEquipmentCost =
        Number(
          item.equipment_cost || 0
        );

      const itemMaterialCost =
        Number(
          item.material_cost || 0
        );

      const calculatedTotal =
        itemManpowerCost +
        itemEquipmentCost +
        itemMaterialCost;

      const itemTotalCost =
        item.total_cost !== null &&
        item.total_cost !== undefined
          ? Number(
              item.total_cost
            )
          : calculatedTotal;

      manpowerCost +=
        itemManpowerCost;

      equipmentCost +=
        itemEquipmentCost;

      materialCost +=
        itemMaterialCost;

      actualCost +=
        itemTotalCost;

    });

    // =================================================
    // BUDGET RATE
    // =================================================

    const budgetRatePerUnit =
      plannedQuantity > 0
        ? budgetCost /
          plannedQuantity
        : 0;

    // =================================================
    // EARNED VALUE
    // =================================================

    const earnedValue =
      budgetRatePerUnit *
      completedQuantity;

    // =================================================
    // PLANNED VALUE
    // =================================================

    const plannedValue =
      budgetCost *
      (
        plannedProgress /
        100
      );

    // =================================================
    // EVM
    // =================================================

    const costVariance =
      earnedValue -
      actualCost;

    const scheduleVariance =
      earnedValue -
      plannedValue;

    const cpi =
      actualCost > 0
        ? earnedValue /
          actualCost
        : 0;

    const spi =
      plannedValue > 0
        ? earnedValue /
          plannedValue
        : 0;

    // =================================================
    // FORECAST
    // =================================================

    let eac = 0;

    let etc = 0;

    let vac = 0;

    let tcpi = 0;

    if (cpi > 0) {

      eac =
        budgetCost /
        cpi;

      etc =
        Math.max(
          eac -
          actualCost,
          0
        );

      vac =
        budgetCost -
        eac;
    }

    const budgetRemaining =
      budgetCost -
      actualCost;

    if (
      budgetRemaining > 0
    ) {

      tcpi =
        (
          budgetCost -
          earnedValue
        ) /
        budgetRemaining;
    }

    // =================================================
// STATUS
// =================================================

let costStatus =
  "ON_BUDGET";

// Actual spending has exceeded approved budget.
if (
  actualCost > budgetCost
) {

  costStatus =
    "OVER_BUDGET";

// Earned-value cost performance is unfavorable,
// but actual spending is still within BAC.
} else if (
  costVariance < 0
) {

  costStatus =
    "COST_UNFAVORABLE";

} else if (
  costVariance > 0
) {

  costStatus =
    "UNDER_BUDGET";
}


// =================================================
// ALERTS
// =================================================// =================================================
    // ALERTS
    // =================================================

    const alerts = [];

    if (
      costStatus ===
      "OVER_BUDGET"
    ) {

      alerts.push({
        category:
          "COST",

        severity:
          "CRITICAL",

        code:
          "PROJECT_OVER_BUDGET",

        message:
          "Project cost performance is above earned-value budget."
      });
    }

    if (
      cpi > 0 &&
      cpi < 0.90
    ) {

      alerts.push({
        category:
          "COST",

        severity:
          "CRITICAL",

        code:
          "LOW_CPI",

        message:
          "Project CPI is below the acceptable threshold of 0.90."
      });

    } else if (
      cpi >= 0.90 &&
      cpi < 1
    ) {

      alerts.push({
        category:
          "COST",

        severity:
          "WARNING",

        code:
          "CPI_WARNING",

        message:
          "Project CPI is below 1.00."
      });
    }

    if (
      spi > 0 &&
      spi < 0.90
    ) {

      alerts.push({
        category:
          "SCHEDULE",

        severity:
          "CRITICAL",

        code:
          "LOW_SPI",

        message:
          "Project SPI is below the acceptable threshold of 0.90."
      });

    } else if (
      spi >= 0.90 &&
      spi < 1
    ) {

      alerts.push({
        category:
          "SCHEDULE",

        severity:
          "WARNING",

        code:
          "SPI_WARNING",

        message:
          "Project SPI is below 1.00."
      });
    }

    if (
      scheduleStatus ===
      "BEHIND"
    ) {

      alerts.push({
        category:
          "SCHEDULE",

        severity:
          "CRITICAL",

        code:
          "PROJECT_BEHIND",

        message:
          "Actual project progress is behind planned progress."
      });
    }

    if (
      eac > 0 &&
      budgetCost > 0 &&
      eac > budgetCost
    ) {

      alerts.push({
        category:
          "FORECAST",

        severity:
          "CRITICAL",

        code:
          "EAC_OVERRUN",

        message:
          "Forecast final project cost exceeds approved budget.",

        forecast_overrun:
          Number(
            (
              eac -
              budgetCost
            ).toFixed(2)
          )
      });
    }

    if (
      tcpi > 1.20
    ) {

      alerts.push({
        category:
          "FORECAST",

        severity:
          "CRITICAL",

        code:
          "HIGH_TCPI",

        message:
          "Required future cost efficiency is significantly above 1.20."
      });

    } else if (
      tcpi > 1
    ) {

      alerts.push({
        category:
          "FORECAST",

        severity:
          "WARNING",

        code:
          "TCPI_WARNING",

        message:
          "Remaining project work requires improved cost efficiency."
      });
    }

    // =================================================
    // HEALTH SCORE
    // =================================================

    let healthScore = 100;

    if (
      costStatus ===
      "OVER_BUDGET"
    ) {

      healthScore -= 25;
    }

    if (
      cpi > 0 &&
      cpi < 0.90
    ) {

      healthScore -= 25;
    }

    if (
      spi > 0 &&
      spi < 0.90
    ) {

      healthScore -= 20;
    }

    if (
      scheduleStatus ===
      "BEHIND"
    ) {

      healthScore -= 15;
    }

    if (
      eac > budgetCost &&
      budgetCost > 0
    ) {

      healthScore -= 10;
    }

    if (
      tcpi > 1.20
    ) {

      healthScore -= 5;
    }

    healthScore =
      Math.max(
        0,
        Math.min(
          100,
          healthScore
        )
      );

    // =================================================
    // HEALTH STATUS
    // =================================================

    let healthStatus =
      "HEALTHY";

    if (
      healthScore < 50
    ) {

      healthStatus =
        "CRITICAL";

    } else if (
      healthScore < 75
    ) {

      healthStatus =
        "WARNING";
    }

    // =================================================
    // PRIORITY
    // =================================================

    let priority =
      "LOW";

    if (
      healthStatus ===
      "CRITICAL"
    ) {

      priority =
        "HIGH";

    } else if (
      healthStatus ===
      "WARNING"
    ) {

      priority =
        "MEDIUM";
    }

    // =================================================
    // MANAGEMENT DECISION
    // =================================================

    let decision =
      "NO_ACTION_REQUIRED";

    if (
      costStatus ===
        "OVER_BUDGET" &&
      cpi > 0 &&
      cpi < 0.90
    ) {

      decision =
        "IMMEDIATE_COST_CONTROL_REQUIRED";

    } else if (
      scheduleStatus ===
        "BEHIND" &&
      spi > 0 &&
      spi < 0.90
    ) {

      decision =
        "SCHEDULE_RECOVERY_REQUIRED";

    } else if (
      alerts.some(
        (alert) =>
          alert.severity ===
          "CRITICAL"
      )
    ) {

      decision =
        "IMMEDIATE_MANAGEMENT_ACTION_REQUIRED";

    } else if (
      alerts.some(
        (alert) =>
          alert.severity ===
          "WARNING"
      )
    ) {

      decision =
        "MANAGEMENT_REVIEW_REQUIRED";
    }

    // =================================================
    // RECOMMENDED ACTIONS
    // =================================================

    const recommendedActions = [];

    if (
      costStatus ===
      "OVER_BUDGET"
    ) {

      recommendedActions.push(
        "Investigate project cost overrun"
      );

      recommendedActions.push(
        "Review manpower cost"
      );

      recommendedActions.push(
        "Review equipment cost"
      );

      recommendedActions.push(
        "Review material cost"
      );
    }

    if (
      cpi > 0 &&
      cpi < 0.90
    ) {

      recommendedActions.push(
        "Improve project cost efficiency"
      );
    }

    if (
      scheduleStatus ===
      "BEHIND"
    ) {

      recommendedActions.push(
        "Prepare schedule recovery plan"
      );

      recommendedActions.push(
        "Review manpower and equipment deployment"
      );
    }

    if (
      eac > budgetCost
    ) {

      recommendedActions.push(
        "Review forecast final cost"
      );
    }

    if (
      tcpi > 1.20
    ) {

      recommendedActions.push(
        "Improve future cost efficiency"
      );
    }

    if (
      recommendedActions.length === 0
    ) {

      recommendedActions.push(
        "Continue normal project monitoring"
      );
    }

    const uniqueActions = [
      ...new Set(
        recommendedActions
      )
    ];

    // =================================================
    // RESPONSE
    // =================================================

    return res.json({

      success: true,

      project_health: {

        status:
          healthStatus,

        score:
          Number(
            healthScore.toFixed(2)
          ),

        priority,

        decision,

        project_id:
          project.id,

        project_code:
          project.project_code,

        project_name:
          project.project_name ||
          project.name,

        project_status:
          project.status
      },

      // =================================================
      // BASELINE
      // =================================================

      baseline: {

        start_date:
          baselineStartDate,

        finish_date:
          baselineFinishDate,

        planned_progress:
          Number(
            plannedProgress.toFixed(2)
          ),

        source:
          baselineStartDate &&
          baselineFinishDate
            ? "BASELINE_DATES"
            : planning &&
              planning.length > 0
              ? "WBS_PLANNING"
              : project.planned_progress !== null &&
                project.planned_progress !== undefined
                ? "PROJECT"
                : "ACTIVITY_FALLBACK"
      },

      // =================================================
      // PROGRESS
      // =================================================

      progress: {

        planned_quantity:
          Number(
            plannedQuantity.toFixed(2)
          ),

        completed_quantity:
          Number(
            completedQuantity.toFixed(2)
          ),

        remaining_quantity:
          Number(
            Math.max(
              plannedQuantity -
              completedQuantity,
              0
            ).toFixed(2)
          ),

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
            progressVariance.toFixed(2)
          ),

        schedule_status:
          scheduleStatus
      },

      // =================================================
      // PRODUCTION
      // =================================================

      production: {

        records:
          production.length,

        total_production:
          Number(
            totalProduction.toFixed(2)
          ),

        total_manpower:
          Number(
            totalManpower.toFixed(2)
          ),

        total_equipment:
          Number(
            totalEquipment.toFixed(2)
          ),

        total_working_hours:
          Number(
            totalWorkingHours.toFixed(2)
          ),

        productivity_per_hour:
          Number(
            productivityPerHour.toFixed(2)
          ),

        productivity_per_man_hour:
          Number(
            productivityPerManHour.toFixed(4)
          )
      },

      // =================================================
      // COST
      // =================================================

      cost: {

        budget_cost:
          Number(
            budgetCost.toFixed(2)
          ),

        actual_cost:
          Number(
            actualCost.toFixed(2)
          ),

        budget_remaining:
          Number(
            budgetRemaining.toFixed(2)
          ),

        cost_variance:
          Number(
            costVariance.toFixed(2)
          ),

        cost_per_unit:
          Number(
            completedQuantity > 0
              ? (
                  actualCost /
                  completedQuantity
                ).toFixed(2)
              : 0
          ),

        budget_rate_per_unit:
          Number(
            budgetRatePerUnit.toFixed(2)
          ),

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
          ),

        cost_status:
          costStatus
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
          alerts.length,

        critical:
          alerts.filter(
            (alert) =>
              alert.severity ===
              "CRITICAL"
          ).length,

        warnings:
          alerts.filter(
            (alert) =>
              alert.severity ===
              "WARNING"
          ).length,

        items:
          alerts
      },

      // =================================================
      // MANAGEMENT
      // =================================================

      management: {

        priority,

        decision,

        recommended_actions:
          uniqueActions
      },

      // =================================================
      // RECORDS
      // =================================================

      records: {

        activity_count:
          activities.length,

        planning_records:
          planning
            ? planning.length
            : 0,

        production_records:
          production.length,

        cost_records:
          costs.length
      }

    });

  } catch (error) {

    console.error(
      "Project health control error:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        "Project health control server error",

      error:
        error.message
    });
  }
});

// =====================================================
// EXPORT
// =====================================================

module.exports = router;







