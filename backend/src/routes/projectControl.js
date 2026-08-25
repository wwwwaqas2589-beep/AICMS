const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// AICMS PROJECT CONTROL
// GET /api/project-control/:project_id
//
// Project
//   -> Planning / Baseline
//   -> Activities
//   -> Production
//   -> Resources
//   -> Productivity
//   -> Cost
//   -> Progress
//   -> EVM
//   -> Forecast
//   -> Alerts
//   -> Management Decision
// =====================================================

router.get("/:project_id", async (req, res) => {
  try {
    const projectId = Number(req.params.project_id);

    // ===================================================
    // VALIDATE PROJECT ID
    // ===================================================

    if (!Number.isInteger(projectId) || projectId <= 0) {
      return res.status(400).json({
        success: false,
        message: "project_id must be a valid positive integer"
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
    // GET PROJECT PLANNING
    // ===================================================

    const {
      data: planning,
      error: planningError
    } = await supabase
      .from("project_planning")
      .select("*")
      .eq("project_id", projectId)
      .order("start_date", {
        ascending: true
      })
      .order("id", {
        ascending: true
      });

    if (planningError) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch project planning",
        error: planningError.message
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
      error: costError
    } = await supabase
      .from("daily_costs")
      .select("*")
      .eq("project_id", projectId)
      .order("cost_date", {
        ascending: false
      });

    if (costError) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch project costs",
        error: costError.message
      });
    }

    // ===================================================
    // PROJECT TOTALS
    // ===================================================

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

    // ===================================================
    // PLANNING TOTALS
    // ===================================================

    let planningQuantity = 0;
    let planningBudget = 0;

    planning.forEach((item) => {
      planningQuantity += Number(
        item.planned_quantity ||
        item.budget_quantity ||
        0
      );

      planningBudget += Number(
        item.budget_cost || 0
      );
    });

    // ===================================================
    // USE PLANNING AS FALLBACK
    // ===================================================

    if (plannedQuantity <= 0 && planningQuantity > 0) {
      plannedQuantity = planningQuantity;
    }

    if (budgetCost <= 0 && planningBudget > 0) {
      budgetCost = planningBudget;
    }

    // ===================================================
    // ACTUAL PROGRESS
    // ===================================================

    let actualProgress = 0;

    if (plannedQuantity > 0) {
      actualProgress =
        (completedQuantity / plannedQuantity) * 100;
    }

    actualProgress = Math.min(
      Math.max(actualProgress, 0),
      100
    );

    const remainingQuantity = Math.max(
      plannedQuantity - completedQuantity,
      0
    );

    // ===================================================
    // BASELINE PLANNED PROGRESS
    //
    // Priority:
    //
    // 1. Project planned_progress if explicitly > 0
    // 2. Planning baseline dates
    // 3. Planning planned_progress
    // 4. 0 if no baseline information exists
    //
    // IMPORTANT:
    // activity.progress_percent is NEVER used as
    // planned progress.
    // ===================================================

    const today = new Date();

    let plannedProgress = 0;
    let baselineStartDate = null;
    let baselineFinishDate = null;

    // ---------------------------------------------------
    // PROJECT EXPLICIT PLANNED PROGRESS
    // ---------------------------------------------------

    if (
      project.planned_progress !== null &&
      project.planned_progress !== undefined &&
      project.planned_progress !== ""
    ) {
      const projectPlannedProgress =
        Number(project.planned_progress);

      if (
        Number.isFinite(projectPlannedProgress) &&
        projectPlannedProgress > 0
      ) {
        plannedProgress =
          projectPlannedProgress;
      }
    }

    // ---------------------------------------------------
    // BASELINE FROM PLANNING
    // ---------------------------------------------------

    if (planning.length > 0) {
      const validPlanning = planning.filter(
        (item) =>
          item.baseline_start_date ||
          item.start_date
      );

      if (validPlanning.length > 0) {
        const startDates = validPlanning
          .map(
            (item) =>
              item.baseline_start_date ||
              item.start_date
          )
          .filter(Boolean)
          .sort();

        const finishDates = validPlanning
          .map(
            (item) =>
              item.baseline_finish_date ||
              item.finish_date
          )
          .filter(Boolean)
          .sort();

        if (startDates.length > 0) {
          baselineStartDate =
            startDates[0];
        }

        if (finishDates.length > 0) {
          baselineFinishDate =
            finishDates[finishDates.length - 1];
        }
      }
    }

    // ---------------------------------------------------
    // CALCULATE PLANNED PROGRESS FROM BASELINE DATES
    // ---------------------------------------------------

    if (
      plannedProgress <= 0 &&
      baselineStartDate &&
      baselineFinishDate
    ) {
      const start = new Date(
        `${baselineStartDate}T00:00:00`
      );

      const finish = new Date(
        `${baselineFinishDate}T00:00:00`
      );

      const current = new Date(
        `${today.toISOString().slice(0, 10)}T00:00:00`
      );

      const totalDuration =
        finish.getTime() -
        start.getTime();

      if (totalDuration > 0) {
        const elapsedDuration =
          current.getTime() -
          start.getTime();

        plannedProgress =
          (
            elapsedDuration /
            totalDuration
          ) * 100;

        plannedProgress = Math.min(
          Math.max(plannedProgress, 0),
          100
        );
      } else if (
        current.getTime() >=
        finish.getTime()
      ) {
        plannedProgress = 100;
      } else {
        plannedProgress = 0;
      }
    }

    // ---------------------------------------------------
    // FALLBACK TO PLANNING PLANNED PROGRESS
    // ---------------------------------------------------

    if (
      plannedProgress <= 0 &&
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

    plannedProgress = Math.min(
      Math.max(plannedProgress, 0),
      100
    );

    // ===================================================
    // PRODUCTION TOTALS
    // ===================================================

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

    // ===================================================
    // PRODUCTIVITY
    // ===================================================

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

    // ===================================================
    // COST TOTALS
    // ===================================================

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
          ? Number(item.total_cost)
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

    // ===================================================
    // BUDGET RATE
    // ===================================================

    const budgetRatePerUnit =
      plannedQuantity > 0
        ? budgetCost /
          plannedQuantity
        : 0;

    // ===================================================
    // EARNED VALUE
    // ===================================================

    const earnedValue =
      budgetRatePerUnit *
      completedQuantity;

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

    // ===================================================
    // FORECAST
    // ===================================================

    let estimateAtCompletion = 0;
    let estimateToComplete = 0;
    let varianceAtCompletion = 0;
    let toCompletePerformanceIndex = 0;

    if (cpi > 0) {
      estimateAtCompletion =
        budgetCost /
        cpi;

      estimateToComplete =
        Math.max(
          estimateAtCompletion -
          actualCost,
          0
        );

      varianceAtCompletion =
        budgetCost -
        estimateAtCompletion;
    }

    const budgetRemaining =
      Math.max(
        budgetCost -
        actualCost,
        0
      );

    const tcpiDenominator =
      budgetCost -
      actualCost;

    if (
      tcpiDenominator > 0
    ) {
      toCompletePerformanceIndex =
        (
          budgetCost -
          earnedValue
        ) /
        tcpiDenominator;
    }

    // ===================================================
    // COST STATUS
    // ===================================================

    let costStatus =
      "ON_BUDGET";

    if (costVariance < 0) {
      costStatus =
        "OVER_BUDGET";
    } else if (costVariance > 0) {
      costStatus =
        "UNDER_BUDGET";
    }

    // ===================================================
    // SCHEDULE STATUS
    // ===================================================

    let scheduleStatus =
      "ON_SCHEDULE";

    if (
      plannedProgress > 0 &&
      actualProgress <
      plannedProgress
    ) {
      scheduleStatus =
        "BEHIND";
    } else if (
      plannedProgress > 0 &&
      actualProgress >
      plannedProgress
    ) {
      scheduleStatus =
        "AHEAD";
    }

    // ===================================================
    // ALERT ENGINE
    // ===================================================

    const alerts = [];

    // ---------------------------------------------------
    // COST
    // ---------------------------------------------------

    if (
      costStatus ===
      "OVER_BUDGET"
    ) {
      alerts.push({
        type: "COST",
        severity: "CRITICAL",
        code:
          "PROJECT_COST_OVER_BUDGET",
        message:
          "Project earned-value cost performance is below budget."
      });
    }

    // ---------------------------------------------------
    // CPI
    // ---------------------------------------------------

    if (
      cpi > 0 &&
      cpi < 0.90
    ) {
      alerts.push({
        type: "COST",
        severity: "CRITICAL",
        code:
          "PROJECT_LOW_CPI",
        message:
          "Project Cost Performance Index is below 0.90."
      });
    } else if (
      cpi >= 0.90 &&
      cpi < 1.00
    ) {
      alerts.push({
        type: "COST",
        severity: "WARNING",
        code:
          "PROJECT_CPI_WARNING",
        message:
          "Project Cost Performance Index is below 1.00."
      });
    }

    // ---------------------------------------------------
    // SPI
    // ---------------------------------------------------

    if (
      spi > 0 &&
      spi < 0.90
    ) {
      alerts.push({
        type: "SCHEDULE",
        severity: "CRITICAL",
        code:
          "PROJECT_LOW_SPI",
        message:
          "Project Schedule Performance Index is below 0.90."
      });
    } else if (
      spi >= 0.90 &&
      spi < 1.00
    ) {
      alerts.push({
        type: "SCHEDULE",
        severity: "WARNING",
        code:
          "PROJECT_SPI_WARNING",
        message:
          "Project Schedule Performance Index is below 1.00."
      });
    }

    // ---------------------------------------------------
    // BEHIND SCHEDULE
    // ---------------------------------------------------

    if (
      scheduleStatus ===
      "BEHIND"
    ) {
      alerts.push({
        type: "SCHEDULE",
        severity: "CRITICAL",
        code:
          "PROJECT_BEHIND",
        message:
          "Project actual progress is behind planned progress."
      });
    }

    // ---------------------------------------------------
    // EAC OVERRUN
    // ---------------------------------------------------

    if (
      estimateAtCompletion > 0 &&
      budgetCost > 0 &&
      estimateAtCompletion >
      budgetCost
    ) {
      alerts.push({
        type: "FORECAST",
        severity: "CRITICAL",
        code:
          "PROJECT_EAC_OVERRUN",
        message:
          "Project forecast final cost exceeds approved budget.",
        forecast_overrun:
          Number(
            (
              estimateAtCompletion -
              budgetCost
            ).toFixed(2)
          )
      });
    }

    // ---------------------------------------------------
    // TCPI
    // ---------------------------------------------------

    if (
      toCompletePerformanceIndex >
      1.20
    ) {
      alerts.push({
        type: "FORECAST",
        severity: "CRITICAL",
        code:
          "PROJECT_HIGH_TCPI",
        message:
          "Project requires significantly higher future cost efficiency."
      });
    } else if (
      toCompletePerformanceIndex >
      1.00
    ) {
      alerts.push({
        type: "FORECAST",
        severity: "WARNING",
        code:
          "PROJECT_TCPI_WARNING",
        message:
          "Remaining project work must be completed more efficiently."
      });
    }

    // ===================================================
    // CRITICAL ACTIVITIES
    // ===================================================

    const criticalActivities = [];

    activities.forEach(
      (activity) => {
        const activityPlannedQuantity =
          Number(
            activity.planned_quantity ||
            0
          );

        const activityCompletedQuantity =
          Number(
            activity.completed_quantity ||
            0
          );

        let activityProgress = 0;

        if (
          activityPlannedQuantity >
          0
        ) {
          activityProgress =
            (
              activityCompletedQuantity /
              activityPlannedQuantity
            ) * 100;
        }

        activityProgress =
          Math.min(
            Math.max(
              activityProgress,
              0
            ),
            100
          );

        const activityPlannedProgress =
          Number(
            activity.planned_progress ||
            0
          );

        if (
          activityPlannedProgress >
            0 &&
          activityProgress <
            activityPlannedProgress
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
                activityPlannedProgress.toFixed(
                  2
                )
              ),

            actual_progress:
              Number(
                activityProgress.toFixed(
                  2
                )
              ),

            status:
              "BEHIND"
          });
        }
      }
    );

    // ===================================================
    // MANAGEMENT
    // ===================================================

    const criticalAlertCount =
      alerts.filter(
        (alert) =>
          alert.severity ===
          "CRITICAL"
      ).length;

    const warningAlertCount =
      alerts.filter(
        (alert) =>
          alert.severity ===
          "WARNING"
      ).length;

    let managementStatus =
      "NORMAL";

    let managementPriority =
      "LOW";

    let managementDecision =
      "NO_ACTION_REQUIRED";

    if (
      criticalAlertCount > 0
    ) {
      managementStatus =
        "CRITICAL";

      managementPriority =
        "HIGH";
    } else if (
      warningAlertCount > 0
    ) {
      managementStatus =
        "WARNING";

      managementPriority =
        "MEDIUM";
    }

    const managementActions = [];

    // ---------------------------------------------------
    // COST CONTROL
    // ---------------------------------------------------

    if (
      costStatus ===
        "OVER_BUDGET" ||
      (
        cpi > 0 &&
        cpi < 0.90
      )
    ) {
      managementActions.push(
        "Investigate project cost overrun"
      );

      managementActions.push(
        "Review manpower, equipment and material costs"
      );

      managementActions.push(
        "Prepare project-wide cost-control action"
      );
    }

    // ---------------------------------------------------
    // FORECAST CONTROL
    // ---------------------------------------------------

    if (
      estimateAtCompletion >
        budgetCost &&
      budgetCost > 0
    ) {
      managementActions.push(
        "Review project forecast and remaining budget"
      );
    }

    if (
      toCompletePerformanceIndex >
      1.20
    ) {
      managementActions.push(
        "Improve future project cost efficiency"
      );
    }

    // ---------------------------------------------------
    // SCHEDULE CONTROL
    // ---------------------------------------------------

    if (
      scheduleStatus ===
      "BEHIND"
    ) {
      managementActions.push(
        "Prepare project schedule recovery plan"
      );

      managementActions.push(
        "Review manpower and equipment deployment"
      );
    }

    // ---------------------------------------------------
    // ACTIVITY CONTROL
    // ---------------------------------------------------

    if (
      criticalActivities.length >
      0
    ) {
      managementActions.push(
        "Review critical/behind activities immediately"
      );
    }

    // ===================================================
    // MANAGEMENT DECISION
    // ===================================================

    if (
      costStatus ===
        "OVER_BUDGET" &&
      estimateAtCompletion >
        budgetCost &&
      cpi > 0 &&
      cpi < 0.90
    ) {
      managementDecision =
        "IMMEDIATE_PROJECT_COST_CONTROL_REQUIRED";

    } else if (
      scheduleStatus ===
        "BEHIND" &&
      spi > 0 &&
      spi < 0.90
    ) {
      managementDecision =
        "PROJECT_SCHEDULE_RECOVERY_REQUIRED";

    } else if (
      managementStatus ===
      "WARNING"
    ) {
      managementDecision =
        "PROJECT_MANAGEMENT_REVIEW_REQUIRED";

    } else if (
      managementStatus ===
      "CRITICAL"
    ) {
      managementDecision =
        "IMMEDIATE_PROJECT_MANAGEMENT_ACTION_REQUIRED";
    }

    const uniqueManagementActions =
      [
        ...new Set(
          managementActions
        )
      ];

    // ===================================================
    // RESPONSE
    // ===================================================

    return res.json({

      success: true,

      project: {
        id:
          project.id,

        project_code:
          project.project_code,

        project_name:
          project.project_name ||
          project.name,

        client:
          project.client,

        location:
          project.location,

        status:
          project.status,

        activity_count:
          activities.length
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
            plannedProgress.toFixed(
              2
            )
          ),

        source:
          baselineStartDate &&
          baselineFinishDate
            ? "BASELINE_DATES"
            : planning.length > 0
              ? "PLANNING"
              : "NONE"
      },

      // =================================================
      // PROGRESS
      // =================================================

      progress: {
        planned_quantity:
          Number(
            plannedQuantity.toFixed(
              2
            )
          ),

        completed_quantity:
          Number(
            completedQuantity.toFixed(
              2
            )
          ),

        remaining_quantity:
          Number(
            remainingQuantity.toFixed(
              2
            )
          ),

        planned_progress:
          Number(
            plannedProgress.toFixed(
              2
            )
          ),

        actual_progress:
          Number(
            actualProgress.toFixed(
              2
            )
          ),

        progress_variance:
          Number(
            (
              actualProgress -
              plannedProgress
            ).toFixed(2)
          )
      },

      // =================================================
      // PRODUCTION
      // =================================================

      production: {
        daily_records:
          production.length,

        total_production:
          Number(
            totalProduction.toFixed(
              2
            )
          ),

        total_manpower:
          Number(
            totalManpower.toFixed(
              2
            )
          ),

        total_equipment:
          Number(
            totalEquipment.toFixed(
              2
            )
          ),

        total_working_hours:
          Number(
            totalWorkingHours.toFixed(
              2
            )
          ),

        productivity_per_hour:
          Number(
            productivityPerHour.toFixed(
              2
            )
          ),

        productivity_per_man_hour:
          Number(
            productivityPerManHour.toFixed(
              4
            )
          )
      },

      // =================================================
      // COST
      // =================================================

      cost: {
        budget_cost:
          Number(
            budgetCost.toFixed(
              2
            )
          ),

        manpower_cost:
          Number(
            manpowerCost.toFixed(
              2
            )
          ),

        equipment_cost:
          Number(
            equipmentCost.toFixed(
              2
            )
          ),

        material_cost:
          Number(
            materialCost.toFixed(
              2
            )
          ),

        actual_cost:
          Number(
            actualCost.toFixed(
              2
            )
          ),

        budget_remaining:
          Number(
            budgetRemaining.toFixed(
              2
            )
          ),

        cost_variance:
          Number(
            costVariance.toFixed(
              2
            )
          ),

        cost_per_unit:
          Number(
            (
              completedQuantity > 0
                ? actualCost /
                  completedQuantity
                : 0
            ).toFixed(2)
          ),

        budget_rate_per_unit:
          Number(
            budgetRatePerUnit.toFixed(
              2
            )
          )
      },

      // =================================================
      // EVM
      // =================================================

      evm: {
        bac:
          Number(
            budgetCost.toFixed(
              2
            )
          ),

        pv:
          Number(
            plannedValue.toFixed(
              2
            )
          ),

        ev:
          Number(
            earnedValue.toFixed(
              2
            )
          ),

        ac:
          Number(
            actualCost.toFixed(
              2
            )
          ),

        cv:
          Number(
            costVariance.toFixed(
              2
            )
          ),

        sv:
          Number(
            scheduleVariance.toFixed(
              2
            )
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
            estimateAtCompletion.toFixed(
              2
            )
          ),

        etc:
          Number(
            estimateToComplete.toFixed(
              2
            )
          ),

        vac:
          Number(
            varianceAtCompletion.toFixed(
              2
            )
          ),

        tcpi:
          Number(
            toCompletePerformanceIndex.toFixed(
              3
            )
          )
      },

      // =================================================
      // ALERTS
      // =================================================

      alerts: {
        status:
          criticalAlertCount > 0
            ? "CRITICAL"
            : warningAlertCount > 0
              ? "WARNING"
              : "NORMAL",

        total:
          alerts.length,

        critical:
          criticalAlertCount,

        warnings:
          warningAlertCount,

        items:
          alerts
      },

      // =================================================
      // MANAGEMENT
      // =================================================

      management: {
        overall_status:
          managementStatus,

        priority:
          managementPriority,

        decision:
          managementDecision,

        alert_count:
          alerts.length,

        critical_alerts:
          criticalAlertCount,

        warning_alerts:
          warningAlertCount,

        critical_activities:
          criticalActivities,

        recommended_actions:
          uniqueManagementActions
      },

      // =================================================
      // CONTROL
      // =================================================

      control: {
        schedule_status:
          scheduleStatus,

        cost_status:
          costStatus
      },

      // =================================================
      // RECORDS
      // =================================================

      records: {
        planning:
          planning,

        activities:
          activities,

        production:
          production,

        costs:
          costs
      }
    });

  } catch (error) {

    console.error(
      "Project control error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

// =====================================================
// EXPORT
// =====================================================

module.exports = router;