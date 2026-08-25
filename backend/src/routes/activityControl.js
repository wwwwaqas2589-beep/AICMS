const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// AICMS ACTIVITY CONTROL
// GET /api/activity-control/:activity_id
//
// Integrated Control:
//
// Activity
//   -> Baseline / Planning
//   -> Production
//   -> Resources
//   -> Productivity
//   -> Cost
//   -> Progress
//   -> EVM
//   -> EVM Forecast
//   -> Management Alerts
//   -> Management Decision
//   -> Recommended Actions
//   -> Documents
//   -> Records
// =====================================================

router.get("/:activity_id", async (req, res) => {
  try {
    const { activity_id } = req.params;

    const activityId = Number(activity_id);

    // =====================================================
    // VALIDATE ACTIVITY ID
    // =====================================================

    if (!Number.isInteger(activityId) || activityId <= 0) {
      return res.status(400).json({
        success: false,
        message: "activity_id must be a valid positive integer"
      });
    }

    // =====================================================
    // GET ACTIVITY
    // =====================================================

    const {
      data: activity,
      error: activityError
    } = await supabase
      .from("work_activities")
      .select("*")
      .eq("id", activityId)
      .maybeSingle();

    if (activityError) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch activity",
        error: activityError.message
      });
    }

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Work activity not found"
      });
    }

    // =====================================================
    // GET PLANNING / BASELINE RECORD
    // =====================================================

    const {
      data: planning,
      error: planningError
    } = await supabase
      .from("project_planning")
      .select("*")
      .eq("activity_id", activityId)
      .order("id", {
        ascending: false
      })
      .limit(1)
      .maybeSingle();

    if (planningError) {
      console.warn(
        "Activity planning lookup warning:",
        planningError.message
      );
    }

    // =====================================================
    // BASIC ACTIVITY DATA
    // =====================================================

    const projectId =
      Number(activity.project_id || 0);

    const plannedQuantity =
      Number(
        activity.planned_quantity ??
        planning?.planned_quantity ??
        0
      );

    const completedQuantity =
      Number(
        activity.completed_quantity ?? 0
      );

    const remainingQuantity =
      Math.max(
        plannedQuantity -
        completedQuantity,
        0
      );

    // =====================================================
    // ACTUAL PROGRESS
    // =====================================================

    let progressPercent = 0;

    if (plannedQuantity > 0) {
      progressPercent =
        (
          completedQuantity /
          plannedQuantity
        ) * 100;
    }

    progressPercent =
      Math.min(
        Math.max(progressPercent, 0),
        100
      );

    // =====================================================
    // BASELINE DATES
    //
    // Priority:
    // 1. Planning baseline dates
    // 2. Planning activity dates
    // 3. Activity dates
    // =====================================================

    const baselineStartDate =
      planning?.baseline_start_date ??
      planning?.start_date ??
      activity.baseline_start_date ??
      activity.start_date ??
      null;

    const baselineFinishDate =
      planning?.baseline_finish_date ??
      planning?.finish_date ??
      activity.baseline_finish_date ??
      activity.finish_date ??
      null;

    // =====================================================
    // CALCULATE BASELINE PLANNED PROGRESS
    //
    // Example:
    //
    // Start  = 2026-08-19
    // Finish = 2026-09-10
    // Today  = 2026-08-23
    //
    // Elapsed = 4 days
    // Duration = 22 days
    //
    // Planned Progress = 4 / 22 × 100
    //                  = 18.18%
    // =====================================================

    let plannedProgress = 0;

    let baselineDurationDays = 0;
    let baselineElapsedDays = 0;

    if (
      baselineStartDate &&
      baselineFinishDate
    ) {
      const start =
        new Date(
          `${baselineStartDate}T00:00:00`
        );

      const finish =
        new Date(
          `${baselineFinishDate}T00:00:00`
        );

      const todayString =
        new Date()
          .toISOString()
          .slice(0, 10);

      const today =
        new Date(
          `${todayString}T00:00:00`
        );

      const millisecondsPerDay =
        1000 *
        60 *
        60 *
        24;

      baselineDurationDays =
        Math.max(
          Math.round(
            (
              finish.getTime() -
              start.getTime()
            ) /
            millisecondsPerDay
          ),
          0
        );

      baselineElapsedDays =
        Math.max(
          Math.round(
            (
              today.getTime() -
              start.getTime()
            ) /
            millisecondsPerDay
          ),
          0
        );

      if (
        baselineDurationDays > 0
      ) {
        plannedProgress =
          (
            baselineElapsedDays /
            baselineDurationDays
          ) * 100;
      } else if (
        today.getTime() >=
        finish.getTime()
      ) {
        plannedProgress = 100;
      }

      plannedProgress =
        Math.min(
          Math.max(
            plannedProgress,
            0
          ),
          100
        );

    } else {

      // ===================================================
      // FALLBACK
      // ===================================================

      plannedProgress =
        Number(
          planning?.planned_progress ??
          activity.planned_progress ??
          0
        );

      plannedProgress =
        Math.min(
          Math.max(
            plannedProgress,
            0
          ),
          100
        );
    }

    // =====================================================
    // DAILY PRODUCTION
    // =====================================================

    const {
      data: production = [],
      error: productionError
    } = await supabase
      .from("daily_production")
      .select("*")
      .eq("activity_id", activityId)
      .order("production_date", {
        ascending: false
      });

    if (productionError) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch production",
        error: productionError.message
      });
    }

    // =====================================================
    // PRODUCTION TOTALS
    // =====================================================

    let totalProduction = 0;
    let totalManpower = 0;
    let totalEquipment = 0;
    let totalWorkingHours = 0;

    production.forEach((item) => {
      totalProduction +=
        Number(
          item.today_quantity || 0
        );

      totalManpower +=
        Number(
          item.manpower || 0
        );

      totalEquipment +=
        Number(
          item.equipment || 0
        );

      totalWorkingHours +=
        Number(
          item.working_hours || 0
        );
    });

    // =====================================================
    // PRODUCTIVITY
    // =====================================================

    let productivityPerHour = 0;

    if (
      totalWorkingHours > 0
    ) {
      productivityPerHour =
        totalProduction /
        totalWorkingHours;
    }

    const totalManHours =
      totalManpower *
      totalWorkingHours;

    let productivityPerManHour = 0;

    if (
      totalManHours > 0
    ) {
      productivityPerManHour =
        totalProduction /
        totalManHours;
    }

    // =====================================================
    // DAILY COST
    // =====================================================

    const {
      data: costs = [],
      error: costError
    } = await supabase
      .from("daily_costs")
      .select("*")
      .eq("activity_id", activityId)
      .order("cost_date", {
        ascending: false
      });

    if (costError) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch activity costs",
        error: costError.message
      });
    }

    // =====================================================
    // COST TOTALS
    // =====================================================

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

      const itemTotalCost =
        Number(
          item.total_cost
        );

      manpowerCost +=
        itemManpowerCost;

      equipmentCost +=
        itemEquipmentCost;

      materialCost +=
        itemMaterialCost;

      if (
        Number.isFinite(
          itemTotalCost
        ) &&
        item.total_cost !== null
      ) {
        actualCost +=
          itemTotalCost;
      } else {
        actualCost +=
          itemManpowerCost +
          itemEquipmentCost +
          itemMaterialCost;
      }
    });

    // =====================================================
    // BUDGET COST / BAC
    // =====================================================

    const budgetCost =
      Number(
        activity.budget_cost ??
        activity.planned_cost ??
        activity.total_budget ??
        planning?.budget_cost ??
        planning?.planned_cost ??
        0
      );

    // =====================================================
    // BUDGET REMAINING
    // =====================================================

    const budgetRemaining =
      budgetCost -
      actualCost;

    // =====================================================
    // COST PER UNIT
    // =====================================================

    let costPerUnit = 0;

    if (
      completedQuantity > 0
    ) {
      costPerUnit =
        actualCost /
        completedQuantity;
    }

    // =====================================================
    // BUDGET RATE PER UNIT
    // =====================================================

    let budgetRatePerUnit = 0;

    if (
      plannedQuantity > 0
    ) {
      budgetRatePerUnit =
        budgetCost /
        plannedQuantity;
    }

    // =====================================================
    // EARNED VALUE
    //
    // EV = Budget Rate × Actual Quantity
    // =====================================================

    const earnedValue =
      budgetRatePerUnit *
      completedQuantity;

    // =====================================================
    // PLANNED VALUE
    //
    // PV = BAC × Planned Progress
    // =====================================================

    const plannedValue =
      budgetCost *
      (
        Math.min(
          plannedProgress,
          100
        ) / 100
      );

    // =====================================================
    // EVM COST VARIANCE
    //
    // CV = EV - AC
    // =====================================================

    const costVarianceEVM =
      earnedValue -
      actualCost;

    // =====================================================
    // EVM SCHEDULE VARIANCE
    //
    // SV = EV - PV
    // =====================================================

    const scheduleVariance =
      earnedValue -
      plannedValue;

    // =====================================================
    // CPI
    //
    // CPI = EV / AC
    // =====================================================

    let cpi = 0;

    if (
      actualCost > 0
    ) {
      cpi =
        earnedValue /
        actualCost;
    }

    // =====================================================
    // SPI
    //
    // SPI = EV / PV
    // =====================================================

    let spi = 0;

    if (
      plannedValue > 0
    ) {
      spi =
        earnedValue /
        plannedValue;
    }

    // =====================================================
    // EVM FORECAST
    //
    // EAC  = BAC / CPI
    // ETC  = EAC - AC
    // VAC  = BAC - EAC
    // TCPI = (BAC - EV) / (BAC - AC)
    // =====================================================

    let estimateAtCompletion = 0;
    let estimateToComplete = 0;
    let varianceAtCompletion = 0;
    let toCompletePerformanceIndex = 0;

    if (
      cpi > 0 &&
      budgetCost > 0
    ) {

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

    // =====================================================
    // TCPI
    // =====================================================

    const remainingBudget =
      budgetCost -
      actualCost;

    if (
      remainingBudget > 0
    ) {
      toCompletePerformanceIndex =
        (
          budgetCost -
          earnedValue
        ) /
        remainingBudget;
    }

        // =====================================================
    // COST STATUS
    // =====================================================

    let costStatus =
      "ON_BUDGET";

    // Actual spending has exceeded approved BAC.
    if (
      actualCost > budgetCost
    ) {

      costStatus =
        "OVER_BUDGET";

    // Earned-value cost performance is unfavorable,
    // but actual spending is still within BAC.
    } else if (
      costVarianceEVM < 0
    ) {

      costStatus =
        "COST_UNFAVORABLE";

    } else if (
      costVarianceEVM > 0
    ) {

      costStatus =
        "UNDER_BUDGET";
    }

    // =====================================================
    // SCHEDULE STATUS
    // =====================================================
// =====================================================
    // SCHEDULE STATUS
    // =====================================================

    let scheduleStatus =
      "ON_SCHEDULE";

    if (
      plannedProgress >
      progressPercent
    ) {
      scheduleStatus =
        "BEHIND";

    } else if (
      progressPercent >
      plannedProgress
    ) {
      scheduleStatus =
        "AHEAD";
    }

    // =====================================================
    // MANAGEMENT ALERT ENGINE
    // =====================================================

    const alerts = [];

    // =====================================================
    // COST ALERT
    // =====================================================

    if (
      costStatus ===
      "OVER_BUDGET"
    ) {
      alerts.push({
        type: "COST",
        severity: "CRITICAL",
        code: "COST_OVER_BUDGET",
        message:
          "Activity is performing above its earned-value budget."
      });
    }

    // =====================================================
    // CPI ALERT
    // =====================================================

    if (
      cpi > 0 &&
      cpi < 0.90
    ) {
      alerts.push({
        type: "COST",
        severity: "CRITICAL",
        code: "LOW_CPI",
        message:
          "Cost Performance Index is below the acceptable threshold of 0.90."
      });

    } else if (
      cpi >= 0.90 &&
      cpi < 1.00
    ) {
      alerts.push({
        type: "COST",
        severity: "WARNING",
        code: "CPI_WARNING",
        message:
          "Cost Performance Index is below 1.00."
      });
    }

    // =====================================================
    // SPI ALERT
    // =====================================================

    if (
      spi > 0 &&
      spi < 0.90
    ) {
      alerts.push({
        type: "SCHEDULE",
        severity: "CRITICAL",
        code: "LOW_SPI",
        message:
          "Schedule Performance Index is below the acceptable threshold of 0.90."
      });

    } else if (
      spi >= 0.90 &&
      spi < 1.00
    ) {
      alerts.push({
        type: "SCHEDULE",
        severity: "WARNING",
        code: "SPI_WARNING",
        message:
          "Schedule Performance Index is below 1.00."
      });
    }

    // =====================================================
    // SCHEDULE STATUS ALERT
    // =====================================================

    if (
      scheduleStatus ===
      "BEHIND"
    ) {
      alerts.push({
        type: "SCHEDULE",
        severity: "CRITICAL",
        code: "ACTIVITY_BEHIND",
        message:
          "Actual progress is behind planned progress.",
        variance:
          Number(
            (
              progressPercent -
              plannedProgress
            ).toFixed(2)
          )
      });
    }

    // =====================================================
    // FORECAST ALERT
    // =====================================================

    if (
      estimateAtCompletion > 0 &&
      budgetCost > 0 &&
      estimateAtCompletion >
      budgetCost
    ) {

      const forecastOverrun =
        estimateAtCompletion -
        budgetCost;

      alerts.push({
        type: "FORECAST",
        severity: "CRITICAL",
        code: "EAC_OVERRUN",
        message:
          "Forecast final cost exceeds the approved activity budget.",
        forecast_overrun:
          Number(
            forecastOverrun.toFixed(2)
          )
      });
    }

    // =====================================================
    // TCPI ALERT
    // =====================================================

    if (
      toCompletePerformanceIndex >
      1.20
    ) {
      alerts.push({
        type: "FORECAST",
        severity: "CRITICAL",
        code: "HIGH_TCPI",
        message:
          "Required future cost efficiency is significantly above 1.20."
      });

    } else if (
      toCompletePerformanceIndex >
      1.00
    ) {
      alerts.push({
        type: "FORECAST",
        severity: "WARNING",
        code: "TCPI_WARNING",
        message:
          "Future work must be completed more efficiently than the original budget efficiency."
      });
    }

    // =====================================================
    // DATA QUALITY ALERT
    // =====================================================

    if (
      plannedQuantity > 0 &&
      completedQuantity >
      plannedQuantity
    ) {
      alerts.push({
        type: "DATA_QUALITY",
        severity: "WARNING",
        code: "QUANTITY_EXCEEDS_PLAN",
        message:
          "Completed quantity exceeds planned quantity."
      });
    }

    // =====================================================
    // ALERT SUMMARY
    // =====================================================

    let alertStatus =
      "NORMAL";

    if (
      alerts.some(
        (alert) =>
          alert.severity ===
          "CRITICAL"
      )
    ) {
      alertStatus =
        "CRITICAL";

    } else if (
      alerts.some(
        (alert) =>
          alert.severity ===
          "WARNING"
      )
    ) {
      alertStatus =
        "WARNING";
    }

    // =====================================================
    // MANAGEMENT DECISION ENGINE
    // =====================================================

    const managementActions = [];

    let managementStatus =
      "NORMAL";

    let managementPriority =
      "LOW";

    let managementDecision =
      "NO_ACTION_REQUIRED";

    // =====================================================
    // COST CONTROL
    // =====================================================

    if (
      costStatus ===
      "OVER_BUDGET" ||
      (
        cpi > 0 &&
        cpi < 0.90
      )
    ) {

      managementActions.push(
        "Investigate activity cost overrun"
      );

      managementActions.push(
        "Review manpower cost"
      );

      managementActions.push(
        "Review equipment cost"
      );

      managementActions.push(
        "Review material cost"
      );
    }

    // =====================================================
    // FORECAST OVERRUN
    // =====================================================

    if (
      estimateAtCompletion >
      budgetCost &&
      budgetCost > 0
    ) {

      managementActions.push(
        "Review activity budget and budget rate"
      );

      managementActions.push(
        "Prepare corrective cost-control action"
      );
    }

    // =====================================================
    // HIGH TCPI
    // =====================================================

    if (
      toCompletePerformanceIndex >
      1.20
    ) {

      managementActions.push(
        "Improve future cost efficiency immediately"
      );

      managementActions.push(
        "Evaluate alternative manpower, equipment and material strategy"
      );
    }

    // =====================================================
    // SCHEDULE CONTROL
    // =====================================================

    if (
      scheduleStatus ===
      "BEHIND" ||
      (
        spi > 0 &&
        spi < 0.90
      )
    ) {

      managementActions.push(
        "Prepare schedule recovery plan"
      );

      managementActions.push(
        "Review manpower and equipment deployment"
      );
    }

    // =====================================================
    // DATA QUALITY
    // =====================================================

    if (
      completedQuantity >
      plannedQuantity &&
      plannedQuantity > 0
    ) {

      managementActions.push(
        "Verify completed quantity against approved measurement records"
      );
    }

    // =====================================================
    // MANAGEMENT STATUS
    // =====================================================

    if (
      alertStatus ===
      "CRITICAL"
    ) {

      managementStatus =
        "CRITICAL";

      managementPriority =
        "HIGH";

    } else if (
      alertStatus ===
      "WARNING"
    ) {

      managementStatus =
        "WARNING";

      managementPriority =
        "MEDIUM";
    }

    // =====================================================
    // MANAGEMENT DECISION
    // =====================================================

    if (
      costStatus ===
      "OVER_BUDGET" &&
      estimateAtCompletion >
      budgetCost &&
      cpi > 0 &&
      cpi < 0.90
    ) {

      managementDecision =
        "IMMEDIATE_COST_CONTROL_REQUIRED";

    } else if (
      scheduleStatus ===
      "BEHIND" &&
      spi > 0 &&
      spi < 0.90
    ) {

      managementDecision =
        "SCHEDULE_RECOVERY_REQUIRED";

    } else if (
      alertStatus ===
      "WARNING"
    ) {

      managementDecision =
        "MANAGEMENT_REVIEW_REQUIRED";

    } else if (
      alertStatus ===
      "CRITICAL"
    ) {

      managementDecision =
        "IMMEDIATE_MANAGEMENT_ACTION_REQUIRED";
    }

    // =====================================================
    // REMOVE DUPLICATE ACTIONS
    // =====================================================

    const uniqueManagementActions =
      [
        ...new Set(
          managementActions
        )
      ];

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.json({

      success: true,

      // ===================================================
      // ACTIVITY
      // ===================================================

      activity: {

        id:
          activity.id,

        project_id:
          projectId,

        activity_code:
          activity.activity_code,

        activity_name:
          activity.activity_name,

        unit:
          activity.unit,

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
            remainingQuantity.toFixed(2)
          ),

        progress_percent:
          Number(
            progressPercent.toFixed(2)
          )
      },

      // ===================================================
      // BASELINE
      // ===================================================

      baseline: {

        start_date:
          baselineStartDate,

        finish_date:
          baselineFinishDate,

        duration_days:
          baselineDurationDays,

        elapsed_days:
          baselineElapsedDays,

        planned_progress:
          Number(
            plannedProgress.toFixed(2)
          ),

        source:
          (
            baselineStartDate &&
            baselineFinishDate
          )
            ? "BASELINE_DATES"
            : "PLANNING_OR_ACTIVITY_PROGRESS"
      },

      // ===================================================
      // PROGRESS
      // ===================================================

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
            remainingQuantity.toFixed(2)
          ),

        planned_progress:
          Number(
            plannedProgress.toFixed(2)
          ),

        actual_progress:
          Number(
            progressPercent.toFixed(2)
          ),

        progress_variance:
          Number(
            (
              progressPercent -
              plannedProgress
            ).toFixed(2)
          )
      },

      // ===================================================
      // PRODUCTION
      // ===================================================

      production: {

        daily_records:
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

      // ===================================================
      // COST
      // ===================================================

      cost: {

        budget_cost:
          Number(
            budgetCost.toFixed(2)
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
            costVarianceEVM.toFixed(2)
          ),

        cost_per_unit:
          Number(
            costPerUnit.toFixed(2)
          ),

        budget_rate_per_unit:
          Number(
            budgetRatePerUnit.toFixed(2)
          )
      },

      // ===================================================
      // EVM
      // ===================================================

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
            costVarianceEVM.toFixed(2)
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
            estimateAtCompletion.toFixed(2)
          ),

        etc:
          Number(
            estimateToComplete.toFixed(2)
          ),

        vac:
          Number(
            varianceAtCompletion.toFixed(2)
          ),

        tcpi:
          Number(
            toCompletePerformanceIndex.toFixed(3)
          )
      },

      // ===================================================
      // MANAGEMENT ALERTS
      // ===================================================

      alerts: {

        status:
          alertStatus,

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

      // ===================================================
      // MANAGEMENT DECISION
      // ===================================================

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
          alerts.filter(
            (alert) =>
              alert.severity ===
              "CRITICAL"
          ).length,

        warning_alerts:
          alerts.filter(
            (alert) =>
              alert.severity ===
              "WARNING"
          ).length,

        recommended_actions:
          uniqueManagementActions
      },

      // ===================================================
      // CONTROL
      // ===================================================

      control: {

        planned_progress:
          Number(
            plannedProgress.toFixed(2)
          ),

        actual_progress:
          Number(
            progressPercent.toFixed(2)
          ),

        progress_variance:
          Number(
            (
              progressPercent -
              plannedProgress
            ).toFixed(2)
          ),

        schedule_status:
          scheduleStatus,

        cost_status:
          costStatus
      },

      // ===================================================
      // DOCUMENTS
      // ===================================================

      documents: {

        status:
          "Document attachment module reserved",

        supported_entities: [
          "project",
          "activity",
          "daily_work",
          "inspection",
          "invoice",
          "payment"
        ]
      },

      // ===================================================
      // RECORDS
      // ===================================================

      records: {

        planning:
          planning
            ? [planning]
            : [],

        production:
          production,

        costs:
          costs
      }
    });

  } catch (error) {

    console.error(
      "Activity control error:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        "Server error",

      error:
        error.message
    });
  }
});

// =====================================================
// EXPORT
// =====================================================

module.exports = router;

