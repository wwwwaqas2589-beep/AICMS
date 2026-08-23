const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// ACTIVITY CONTROL
// GET /api/activity-control/:activity_id
//
// Integrated view:
//
// Activity
//   -> Production
//   -> Resources
//   -> Cost
//   -> Progress
//   -> Productivity
//   -> EVM
// =====================================================

router.get("/:activity_id", async (req, res) => {
  try {
    const { activity_id } = req.params;

    const activityId = Number(activity_id);

    // =================================================
    // VALIDATE ACTIVITY ID
    // =================================================

    if (!Number.isInteger(activityId) || activityId <= 0) {
      return res.status(400).json({
        success: false,
        message: "activity_id must be a valid positive integer"
      });
    }

    // =================================================
    // GET ACTIVITY
    // =================================================

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

    // =================================================
    // BASIC ACTIVITY DATA
    // =================================================

    const projectId = Number(activity.project_id);

    const plannedQuantity =
      Number(activity.planned_quantity || 0);

    const completedQuantity =
      Number(activity.completed_quantity || 0);

    const remainingQuantity =
      Math.max(
        plannedQuantity - completedQuantity,
        0
      );

    let progressPercent = 0;

    if (plannedQuantity > 0) {
      progressPercent =
        (completedQuantity / plannedQuantity) * 100;
    }

    progressPercent =
      Math.min(progressPercent, 100);

    // =================================================
    // DAILY PRODUCTION
    // =================================================

    const {
      data: production,
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

    // =================================================
    // PRODUCTION TOTALS
    // =================================================

    let totalProduction = 0;
    let totalManpower = 0;
    let totalEquipment = 0;
    let totalWorkingHours = 0;

    production.forEach((item) => {
      totalProduction +=
        Number(item.today_quantity || 0);

      totalManpower +=
        Number(item.manpower || 0);

      totalEquipment +=
        Number(item.equipment || 0);

      totalWorkingHours +=
        Number(item.working_hours || 0);
    });

    // =================================================
    // PRODUCTIVITY
    // =================================================

    let productivityPerHour = 0;

    if (totalWorkingHours > 0) {
      productivityPerHour =
        totalProduction /
        totalWorkingHours;
    }

    let productivityPerManHour = 0;

    const totalManHours =
      totalManpower *
      totalWorkingHours;

    if (totalManHours > 0) {
      productivityPerManHour =
        totalProduction /
        totalManHours;
    }

    // =================================================
    // DAILY COST
    // =================================================

    const {
      data: costs,
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

    // =================================================
    // COST TOTALS
    // =================================================

    let manpowerCost = 0;
    let equipmentCost = 0;
    let materialCost = 0;
    let actualCost = 0;

    costs.forEach((item) => {

      manpowerCost +=
        Number(item.manpower_cost || 0);

      equipmentCost +=
        Number(item.equipment_cost || 0);

      materialCost +=
        Number(item.material_cost || 0);

      actualCost +=
        Number(
          item.total_cost ||
          (
            Number(item.manpower_cost || 0) +
            Number(item.equipment_cost || 0) +
            Number(item.material_cost || 0)
          )
        );
    });

    // =================================================
    // BUDGET COST
    // =================================================

    const budgetCost =
      Number(
        activity.budget_cost ||
        activity.planned_cost ||
        activity.total_budget ||
        0
      );

    // =================================================
    // COST VARIANCE
    // =================================================

    const costVariance =
      budgetCost - actualCost;

    // =================================================
    // COST PER UNIT
    // =================================================

    let costPerUnit = 0;

    if (completedQuantity > 0) {
      costPerUnit =
        actualCost /
        completedQuantity;
    }

    // =================================================
    // BUDGET RATE PER UNIT
    // =================================================

    let budgetRatePerUnit = 0;

    if (plannedQuantity > 0) {
      budgetRatePerUnit =
        budgetCost /
        plannedQuantity;
    }

    // =================================================
    // EARNED VALUE
    // =================================================

    const earnedValue =
      budgetRatePerUnit *
      completedQuantity;

    // =================================================
    // PLANNED VALUE
    //
    // If activity has planned_progress,
    // use it as current planned progress.
    // =================================================

    const plannedProgress =
      Number(
        activity.planned_progress ||
        activity.progress_percent ||
        0
      );

    const plannedValue =
      budgetCost *
      (Math.min(plannedProgress, 100) / 100);

    // =================================================
    // COST PERFORMANCE INDEX
    // =================================================

    let cpi = 0;

    if (actualCost > 0) {
      cpi =
        earnedValue /
        actualCost;
    }

    // =================================================
    // SCHEDULE PERFORMANCE INDEX
    // =================================================

    let spi = 0;

    if (plannedValue > 0) {
      spi =
        earnedValue /
        plannedValue;
    }

    // =================================================
    // COST STATUS
    // =================================================

    let costStatus = "ON_BUDGET";

    if (actualCost > budgetCost && budgetCost > 0) {
      costStatus = "OVER_BUDGET";
    } else if (
      actualCost < budgetCost &&
      budgetCost > 0
    ) {
      costStatus = "UNDER_BUDGET";
    }

    // =================================================
    // SCHEDULE STATUS
    // =================================================

    let scheduleStatus = "ON_SCHEDULE";

    if (
      plannedProgress > progressPercent
    ) {
      scheduleStatus = "BEHIND";
    } else if (
      progressPercent > plannedProgress
    ) {
      scheduleStatus = "AHEAD";
    }

    // =================================================
    // EVM VARIANCES
    // =================================================

    const costVarianceEVM =
      earnedValue - actualCost;

    const scheduleVariance =
      earnedValue - plannedValue;

    // =================================================
    // RESPONSE
    // =================================================

    return res.json({

      success: true,

      activity: {
        id: activity.id,
        project_id: projectId,
        activity_code: activity.activity_code,
        activity_name: activity.activity_name,
        unit: activity.unit,

        planned_quantity:
          Number(plannedQuantity.toFixed(2)),

        completed_quantity:
          Number(completedQuantity.toFixed(2)),

        remaining_quantity:
          Number(remainingQuantity.toFixed(2)),

        progress_percent:
          Number(progressPercent.toFixed(2))
      },

      production: {

        daily_records:
          production.length,

        total_production:
          Number(totalProduction.toFixed(2)),

        total_manpower:
          Number(totalManpower.toFixed(2)),

        total_equipment:
          Number(totalEquipment.toFixed(2)),

        total_working_hours:
          Number(totalWorkingHours.toFixed(2)),

        productivity_per_hour:
          Number(productivityPerHour.toFixed(2)),

        productivity_per_man_hour:
          Number(productivityPerManHour.toFixed(4))
      },

      cost: {

        budget_cost:
          Number(budgetCost.toFixed(2)),

        manpower_cost:
          Number(manpowerCost.toFixed(2)),

        equipment_cost:
          Number(equipmentCost.toFixed(2)),

        material_cost:
          Number(materialCost.toFixed(2)),

        actual_cost:
          Number(actualCost.toFixed(2)),

        cost_variance:
          Number(costVariance.toFixed(2)),

        cost_per_unit:
          Number(costPerUnit.toFixed(2)),

        budget_rate_per_unit:
          Number(budgetRatePerUnit.toFixed(2))
      },

      evm: {

        bac:
          Number(budgetCost.toFixed(2)),

        pv:
          Number(plannedValue.toFixed(2)),

        ev:
          Number(earnedValue.toFixed(2)),

        ac:
          Number(actualCost.toFixed(2)),

        cv:
          Number(costVarianceEVM.toFixed(2)),

        sv:
          Number(scheduleVariance.toFixed(2)),

        cpi:
          Number(cpi.toFixed(3)),

        spi:
          Number(spi.toFixed(3))
      },

      control: {

        planned_progress:
          Number(plannedProgress.toFixed(2)),

        actual_progress:
          Number(progressPercent.toFixed(2)),

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

      documents: {
        status: "Document attachment module reserved",
        supported_entities: [
          "project",
          "activity",
          "daily_work",
          "inspection",
          "invoice",
          "payment"
        ]
      },

      records: {
        production: production,
        costs: costs
      }

    });

  } catch (error) {

    console.error(
      "Activity control error:",
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