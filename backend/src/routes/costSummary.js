const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// HELPERS
// =====================================================

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round(value) {
  return Number(num(value).toFixed(2));
}

function getTotalCost(item) {
  return num(
    item.total_cost ??
    item.totalCost ??
    0
  );
}

// =====================================================
// CALCULATE ACTIVITY ACTUAL COST
// =====================================================

async function calculateActivityCost(activityId) {

  // ===================================================
  // MANPOWER
  // ===================================================

  const {
    data: manpower,
    error: manpowerError
  } = await supabase
    .from("manpower_records")
    .select("*")
    .eq("activity_id", activityId);

  if (manpowerError) {
    throw new Error(
      "Failed to fetch manpower: " +
      manpowerError.message
    );
  }

  // ===================================================
  // EQUIPMENT
  // ===================================================

  const {
    data: equipment,
    error: equipmentError
  } = await supabase
    .from("equipment_records")
    .select("*")
    .eq("activity_id", activityId);

  if (equipmentError) {
    throw new Error(
      "Failed to fetch equipment: " +
      equipmentError.message
    );
  }

  // ===================================================
  // MATERIAL
  // ===================================================

  const {
    data: materials,
    error: materialError
  } = await supabase
    .from("material_transactions")
    .select("*")
    .eq("activity_id", activityId);

  if (materialError) {
    throw new Error(
      "Failed to fetch materials: " +
      materialError.message
    );
  }

  // ===================================================
  // COST CALCULATION
  // ===================================================

  let manpowerCost = 0;
  let equipmentCost = 0;
  let materialCost = 0;

  // ---------------------------------------------------
  // MANPOWER COST
  // ---------------------------------------------------

  (manpower || []).forEach((item) => {

    manpowerCost += getTotalCost(item);

  });

  // ---------------------------------------------------
  // EQUIPMENT COST
  // ---------------------------------------------------

  (equipment || []).forEach((item) => {

    equipmentCost += getTotalCost(item);

  });

  // ---------------------------------------------------
  // MATERIAL COST
  // IMPORTANT:
  // Only CONSUMPTION is actual project cost.
  // RECEIPT is inventory/procurement movement.
  // Counting both causes double counting.
  // ---------------------------------------------------

  (materials || []).forEach((item) => {

    const transactionType =
      String(
        item.transaction_type || ""
      ).toLowerCase();

    if (transactionType === "consumption") {

      materialCost += getTotalCost(item);

    }

  });

  // ===================================================
  // TOTAL ACTUAL COST
  // ===================================================

  const totalActualCost =
    manpowerCost +
    equipmentCost +
    materialCost;

  return {

    manpowerCost:
      round(manpowerCost),

    equipmentCost:
      round(equipmentCost),

    materialCost:
      round(materialCost),

    totalActualCost:
      round(totalActualCost)

  };
}

// =====================================================
// GET PROJECT COST SUMMARY
//
// GET /api/cost-summary/project/:project_id
// =====================================================

router.get(
  "/project/:project_id",
  async (req, res) => {

    try {

      const projectId =
        Number(req.params.project_id);

      if (!Number.isInteger(projectId) || projectId <= 0) {

        return res.status(400).json({
          success: false,
          message: "Invalid project_id"
        });

      }

      // =================================================
      // MANPOWER
      // =================================================

      const {
        data: manpower,
        error: manpowerError
      } = await supabase
        .from("manpower_records")
        .select("*")
        .eq("project_id", projectId);

      if (manpowerError) {

        return res.status(500).json({
          success: false,
          message: "Failed to fetch manpower cost",
          error: manpowerError.message
        });

      }

      // =================================================
      // EQUIPMENT
      // =================================================

      const {
        data: equipment,
        error: equipmentError
      } = await supabase
        .from("equipment_records")
        .select("*")
        .eq("project_id", projectId);

      if (equipmentError) {

        return res.status(500).json({
          success: false,
          message: "Failed to fetch equipment cost",
          error: equipmentError.message
        });

      }

      // =================================================
      // MATERIAL
      // =================================================

      const {
        data: materials,
        error: materialError
      } = await supabase
        .from("material_transactions")
        .select("*")
        .eq("project_id", projectId);

      if (materialError) {

        return res.status(500).json({
          success: false,
          message: "Failed to fetch material cost",
          error: materialError.message
        });

      }

      // =================================================
      // PROJECT TOTALS
      // =================================================

      let manpowerCost = 0;
      let equipmentCost = 0;
      let materialCost = 0;

      // -------------------------------------------------
      // MANPOWER
      // -------------------------------------------------

      (manpower || []).forEach((item) => {

        manpowerCost +=
          getTotalCost(item);

      });

      // -------------------------------------------------
      // EQUIPMENT
      // -------------------------------------------------

      (equipment || []).forEach((item) => {

        equipmentCost +=
          getTotalCost(item);

      });

      // -------------------------------------------------
      // MATERIAL CONSUMPTION ONLY
      // -------------------------------------------------

      (materials || []).forEach((item) => {

        const transactionType =
          String(
            item.transaction_type || ""
          ).toLowerCase();

        if (
          transactionType ===
          "consumption"
        ) {

          materialCost +=
            getTotalCost(item);

        }

      });

      const totalActualCost =
        manpowerCost +
        equipmentCost +
        materialCost;

      // =================================================
      // ACTIVITY COST BREAKDOWN
      // =================================================

      const activityCosts = {};

      // -------------------------------------------------
      // CREATE ACTIVITY
      // -------------------------------------------------

      function ensureActivity(activityId) {

        if (!activityCosts[activityId]) {

          activityCosts[activityId] = {

            activity_id:
              Number(activityId),

            manpower_cost: 0,

            equipment_cost: 0,

            material_cost: 0,

            total_actual_cost: 0

          };

        }

        return activityCosts[activityId];

      }

      // -------------------------------------------------
      // MANPOWER BY ACTIVITY
      // -------------------------------------------------

      (manpower || []).forEach((item) => {

        if (
          item.activity_id === null ||
          item.activity_id === undefined
        ) {
          return;
        }

        const activity =
          ensureActivity(
            item.activity_id
          );

        activity.manpower_cost +=
          getTotalCost(item);

      });

      // -------------------------------------------------
      // EQUIPMENT BY ACTIVITY
      // -------------------------------------------------

      (equipment || []).forEach((item) => {

        if (
          item.activity_id === null ||
          item.activity_id === undefined
        ) {
          return;
        }

        const activity =
          ensureActivity(
            item.activity_id
          );

        activity.equipment_cost +=
          getTotalCost(item);

      });

      // -------------------------------------------------
      // MATERIAL BY ACTIVITY
      // CONSUMPTION ONLY
      // -------------------------------------------------

      (materials || []).forEach((item) => {

        if (
          item.activity_id === null ||
          item.activity_id === undefined
        ) {
          return;
        }

        const transactionType =
          String(
            item.transaction_type || ""
          ).toLowerCase();

        if (
          transactionType !==
          "consumption"
        ) {
          return;
        }

        const activity =
          ensureActivity(
            item.activity_id
          );

        activity.material_cost +=
          getTotalCost(item);

      });

      // -------------------------------------------------
      // FINAL ACTIVITY TOTALS
      // -------------------------------------------------

      Object.values(activityCosts)
        .forEach((item) => {

          item.total_actual_cost =
            item.manpower_cost +
            item.equipment_cost +
            item.material_cost;

          item.manpower_cost =
            round(
              item.manpower_cost
            );

          item.equipment_cost =
            round(
              item.equipment_cost
            );

          item.material_cost =
            round(
              item.material_cost
            );

          item.total_actual_cost =
            round(
              item.total_actual_cost
            );

        });

      // =================================================
      // RESPONSE
      // =================================================

      return res.json({

        success: true,

        project_id:
          projectId,

        summary: {

          manpower_cost:
            round(manpowerCost),

          equipment_cost:
            round(equipmentCost),

          material_cost:
            round(materialCost),

          total_actual_cost:
            round(totalActualCost)

        },

        activity_costs:
          Object.values(activityCosts)

      });

    } catch (error) {

      console.error(
        "Project cost error:",
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

  }
);

// =====================================================
// GET ACTIVITY COST
//
// GET /api/cost-summary/activity/:activity_id
// =====================================================

router.get(
  "/activity/:activity_id",
  async (req, res) => {

    try {

      const activityId =
        Number(req.params.activity_id);

      if (
        !Number.isInteger(activityId) ||
        activityId <= 0
      ) {

        return res.status(400).json({
          success: false,
          message: "Invalid activity_id"
        });

      }

      // =================================================
      // ACTIVITY
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

          message:
            "Failed to fetch work activity",

          error:
            activityError.message

        });

      }

      if (!activity) {

        return res.status(404).json({

          success: false,

          message:
            "Work activity not found"

        });

      }

      // =================================================
      // ACTUAL COST
      // =================================================

      const actual =
        await calculateActivityCost(
          activityId
        );

      // =================================================
      // QUANTITY
      // =================================================

      const plannedQuantity =
        Math.max(
          num(activity.planned_quantity),
          0
        );

      const completedQuantity =
        Math.min(
          Math.max(
            num(activity.completed_quantity),
            0
          ),
          plannedQuantity
        );

      const remainingQuantity =
        Math.max(
          plannedQuantity -
          completedQuantity,
          0
        );

      // =================================================
      // PROGRESS
      // =================================================

      let progressPercent = 0;

      if (
        plannedQuantity > 0
      ) {

        progressPercent =
          (
            completedQuantity /
            plannedQuantity
          ) * 100;

      }

      progressPercent =
        Math.min(
          Math.max(
            progressPercent,
            0
          ),
          100
        );

      // =================================================
      // PLANNED RATE
      // =================================================

      const plannedUnitRate =
        Math.max(
          num(
            activity.planned_unit_rate
          ),
          0
        );

      // =================================================
      // BAC
      // BUDGET AT COMPLETION
      // =================================================

      let plannedTotalCost =
        Math.max(
          num(
            activity.planned_total_cost
          ),
          0
        );

      if (
        plannedTotalCost === 0 &&
        plannedQuantity > 0 &&
        plannedUnitRate > 0
      ) {

        plannedTotalCost =
          plannedQuantity *
          plannedUnitRate;

      }

      // =================================================
      // PLANNED VALUE OF COMPLETED QUANTITY
      // =================================================

      const plannedValue =
        completedQuantity *
        plannedUnitRate;

      // =================================================
      // ACTUAL COST PER UNIT
      // =================================================

      let actualCostPerUnit = 0;

      if (
        completedQuantity > 0
      ) {

        actualCostPerUnit =
          actual.totalActualCost /
          completedQuantity;

      }

      // =================================================
      // EAC
      // =================================================

      let estimatedTotalCost = 0;

      if (
        completedQuantity > 0 &&
        plannedQuantity > 0
      ) {

        estimatedTotalCost =
          actualCostPerUnit *
          plannedQuantity;

      }

      const remainingEstimatedCost =
        Math.max(
          estimatedTotalCost -
          actual.totalActualCost,
          0
        );

      // =================================================
      // COST VARIANCE
      //
      // CV = PV of completed work - AC
      // =================================================

      const costVariance =
        plannedValue -
        actual.totalActualCost;

      let variancePercent = 0;

      if (
        plannedValue > 0
      ) {

        variancePercent =
          (
            costVariance /
            plannedValue
          ) * 100;

      }

      // =================================================
      // REMAINING BUDGET
      // =================================================

      const remainingBudget =
        Math.max(
          plannedTotalCost -
          actual.totalActualCost,
          0
        );

      // =================================================
      // STATUS
      // =================================================

      let status =
        "NO_BUDGET";

      if (
        plannedValue > 0
      ) {

        if (
          costVariance > 0
        ) {

          status =
            "UNDER_BUDGET";

        } else if (
          costVariance < 0
        ) {

          status =
            "OVER_BUDGET";

        } else {

          status =
            "ON_BUDGET";

        }

      }

      // =================================================
      // RESPONSE
      // =================================================

      return res.json({

        success: true,

        activity: {

          id:
            activity.id,

          project_id:
            activity.project_id,

          activity_code:
            activity.activity_code,

          activity_name:
            activity.activity_name,

          unit:
            activity.unit,

          planned_quantity:
            round(
              plannedQuantity
            ),

          completed_quantity:
            round(
              completedQuantity
            ),

          remaining_quantity:
            round(
              remainingQuantity
            ),

          progress_percent:
            round(
              progressPercent
            )

        },

        cost: {

          manpower_cost:
            round(
              actual.manpowerCost
            ),

          equipment_cost:
            round(
              actual.equipmentCost
            ),

          material_cost:
            round(
              actual.materialCost
            ),

          total_actual_cost:
            round(
              actual.totalActualCost
            ),

          planned_unit_rate:
            round(
              plannedUnitRate
            ),

          planned_total_cost:
            round(
              plannedTotalCost
            ),

          planned_value:
            round(
              plannedValue
            ),

          cost_per_unit:
            round(
              actualCostPerUnit
            ),

          estimated_total_cost:
            round(
              estimatedTotalCost
            ),

          remaining_estimated_cost:
            round(
              remainingEstimatedCost
            )

        }

      });

    } catch (error) {

      console.error(
        "Activity cost error:",
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

  }
);

// =====================================================
// COST VARIANCE
//
// GET /api/cost-summary/variance/:activity_id
// =====================================================

router.get(
  "/variance/:activity_id",
  async (req, res) => {

    try {

      const activityId =
        Number(req.params.activity_id);

      if (
        !Number.isInteger(activityId) ||
        activityId <= 0
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Invalid activity_id"

        });

      }

      // =================================================
      // ACTIVITY
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

          message:
            "Failed to fetch activity",

          error:
            activityError.message

        });

      }

      if (!activity) {

        return res.status(404).json({

          success: false,

          message:
            "Work activity not found"

        });

      }

      // =================================================
      // ACTUAL
      // =================================================

      const actual =
        await calculateActivityCost(
          activityId
        );

      // =================================================
      // QUANTITY
      // =================================================

      const plannedQuantity =
        Math.max(
          num(
            activity.planned_quantity
          ),
          0
        );

      const completedQuantity =
        Math.min(
          Math.max(
            num(
              activity.completed_quantity
            ),
            0
          ),
          plannedQuantity
        );

      const remainingQuantity =
        Math.max(
          plannedQuantity -
          completedQuantity,
          0
        );

      // =================================================
      // PLANNED COST
      // =================================================

      const plannedUnitRate =
        Math.max(
          num(
            activity.planned_unit_rate
          ),
          0
        );

      let plannedTotalCost =
        Math.max(
          num(
            activity.planned_total_cost
          ),
          0
        );

      if (
        plannedTotalCost === 0 &&
        plannedQuantity > 0 &&
        plannedUnitRate > 0
      ) {

        plannedTotalCost =
          plannedQuantity *
          plannedUnitRate;

      }

      // =================================================
      // VALUE OF COMPLETED WORK
      // =================================================

      const earnedValue =
        completedQuantity *
        plannedUnitRate;

      // =================================================
      // ACTUAL UNIT COST
      // =================================================

      let actualCostPerUnit = 0;

      if (
        completedQuantity > 0
      ) {

        actualCostPerUnit =
          actual.totalActualCost /
          completedQuantity;

      }

      // =================================================
      // COST VARIANCE
      // CV = EV - AC
      // =================================================

      const costVariance =
        earnedValue -
        actual.totalActualCost;

      let variancePercent = 0;

      if (
        earnedValue > 0
      ) {

        variancePercent =
          (
            costVariance /
            earnedValue
          ) * 100;

      }

      // =================================================
      // REMAINING BUDGET
      // =================================================

      const remainingBudget =
        Math.max(
          plannedTotalCost -
          actual.totalActualCost,
          0
        );

      // =================================================
      // STATUS
      // =================================================

      let status =
        "NO_BUDGET";

      if (
        earnedValue > 0
      ) {

        if (
          costVariance > 0
        ) {

          status =
            "UNDER_BUDGET";

        } else if (
          costVariance < 0
        ) {

          status =
            "OVER_BUDGET";

        } else {

          status =
            "ON_BUDGET";

        }

      }

      // =================================================
      // RESPONSE
      // =================================================

      return res.json({

        success: true,

        activity: {

          id:
            activity.id,

          project_id:
            activity.project_id,

          activity_code:
            activity.activity_code,

          activity_name:
            activity.activity_name,

          unit:
            activity.unit,

          planned_quantity:
            round(
              plannedQuantity
            ),

          completed_quantity:
            round(
              completedQuantity
            ),

          remaining_quantity:
            round(
              remainingQuantity
            )

        },

        planned_cost: {

          planned_unit_rate:
            round(
              plannedUnitRate
            ),

          planned_total_cost:
            round(
              plannedTotalCost
            )

        },

        actual_cost: {

          manpower_cost:
            round(
              actual.manpowerCost
            ),

          equipment_cost:
            round(
              actual.equipmentCost
            ),

          material_cost:
            round(
              actual.materialCost
            ),

          total_actual_cost:
            round(
              actual.totalActualCost
            ),

          actual_cost_per_unit:
            round(
              actualCostPerUnit
            )

        },

        earned_value: {

          earned_value:
            round(
              earnedValue
            )

        },

        variance: {

          cost_variance:
            round(
              costVariance
            ),

          variance_percent:
            round(
              variancePercent
            ),

          remaining_budget:
            round(
              remainingBudget
            ),

          status

        }

      });

    } catch (error) {

      console.error(
        "Cost variance error:",
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

  }
);

// =====================================================
// EARNED VALUE MANAGEMENT
//
// GET /api/cost-summary/evm/:activity_id
// =====================================================

router.get(
  "/evm/:activity_id",
  async (req, res) => {

    try {

      const activityId =
        Number(req.params.activity_id);

      if (
        !Number.isInteger(activityId) ||
        activityId <= 0
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Invalid activity_id"

        });

      }

      // =================================================
      // ACTIVITY
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

          message:
            "Failed to fetch work activity",

          error:
            activityError.message

        });

      }

      if (!activity) {

        return res.status(404).json({

          success: false,

          message:
            "Work activity not found"

        });

      }

      // =================================================
      // ACTUAL COST
      // =================================================

      const actual =
        await calculateActivityCost(
          activityId
        );

      const actualCost =
        actual.totalActualCost;

      // =================================================
      // QUANTITY
      // =================================================

      const plannedQuantity =
        Math.max(
          num(
            activity.planned_quantity
          ),
          0
        );

      const completedQuantity =
        Math.min(
          Math.max(
            num(
              activity.completed_quantity
            ),
            0
          ),
          plannedQuantity
        );

      const remainingQuantity =
        Math.max(
          plannedQuantity -
          completedQuantity,
          0
        );

      // =================================================
      // PROGRESS
      // =================================================

      let progressPercent = 0;

      if (
        plannedQuantity > 0
      ) {

        progressPercent =
          (
            completedQuantity /
            plannedQuantity
          ) * 100;

      }

      progressPercent =
        Math.min(
          Math.max(
            progressPercent,
            0
          ),
          100
        );

      // =================================================
      // PLANNED UNIT RATE
      // =================================================

      const plannedUnitRate =
        Math.max(
          num(
            activity.planned_unit_rate
          ),
          0
        );

      // =================================================
      // BAC
      // BUDGET AT COMPLETION
      // =================================================

      let budgetAtCompletion =
        Math.max(
          num(
            activity.planned_total_cost
          ),
          0
        );

      if (
        budgetAtCompletion === 0 &&
        plannedQuantity > 0 &&
        plannedUnitRate > 0
      ) {

        budgetAtCompletion =
          plannedQuantity *
          plannedUnitRate;

      }

      // =================================================
      // EV
      // EARNED VALUE
      //
      // EV = completed quantity × planned rate
      // =================================================

      const earnedValue =
        completedQuantity *
        plannedUnitRate;

      // =================================================
      // PV
      //
      // IMPORTANT:
      // Exact PV requires time-phased baseline data.
      //
      // If planned_value exists in DB, use it.
      // Otherwise return null instead of incorrectly
      // setting PV = EV.
      // =================================================

      let plannedValue = null;

      if (
        activity.planned_value !== null &&
        activity.planned_value !== undefined
      ) {

        plannedValue =
          num(
            activity.planned_value
          );

      }

      // =================================================
      // CV
      // =================================================

      const costVariance =
        earnedValue -
        actualCost;

      // =================================================
      // CPI
      // =================================================

      let cpi = 0;

      if (
        actualCost > 0
      ) {

        cpi =
          earnedValue /
          actualCost;

      }

      // =================================================
      // EAC
      //
      // EAC = BAC / CPI
      // =================================================

      let estimateAtCompletion = 0;

      if (
        cpi > 0 &&
        budgetAtCompletion > 0
      ) {

        estimateAtCompletion =
          budgetAtCompletion /
          cpi;

      }

      // =================================================
      // ETC
      // =================================================

      let estimateToComplete = 0;

      if (
        estimateAtCompletion > 0
      ) {

        estimateToComplete =
          Math.max(
            estimateAtCompletion -
            actualCost,
            0
          );

      }

      // =================================================
      // VAC
      // =================================================

      let varianceAtCompletion = 0;

      if (
        estimateAtCompletion > 0
      ) {

        varianceAtCompletion =
          budgetAtCompletion -
          estimateAtCompletion;

      }

      // =================================================
      // TCPI
      //
      // TCPI = (BAC - EV) / (BAC - AC)
      // =================================================

      let tcpi = 0;

      const remainingWorkValue =
        budgetAtCompletion -
        earnedValue;

      const remainingBudget =
        budgetAtCompletion -
        actualCost;

      if (
        remainingBudget > 0
      ) {

        tcpi =
          remainingWorkValue /
          remainingBudget;

      }

      // =================================================
      // SCHEDULE PERFORMANCE
      //
      // Cannot calculate SPI accurately without PV.
      // =================================================

      let scheduleVariance = null;
      let spi = null;

      if (
        plannedValue !== null
      ) {

        scheduleVariance =
          earnedValue -
          plannedValue;

        if (
          plannedValue > 0
        ) {

          spi =
            earnedValue /
            plannedValue;

        } else {

          spi = 0;

        }

      }

      // =================================================
      // COST STATUS
      // =================================================

      let costStatus =
        "NO_DATA";

      if (
        budgetAtCompletion > 0 &&
        actualCost > 0
      ) {

        if (
          cpi > 1.05
        ) {

          costStatus =
            "UNDER_COST";

        } else if (
          cpi < 0.95
        ) {

          costStatus =
            "OVER_COST";

        } else {

          costStatus =
            "ON_COST";

        }

      }

      // =================================================
      // SCHEDULE STATUS
      // =================================================

      let scheduleStatus =
        "NO_BASELINE";

      if (
        spi !== null
      ) {

        if (
          spi > 1.05
        ) {

          scheduleStatus =
            "AHEAD";

        } else if (
          spi < 0.95
        ) {

          scheduleStatus =
            "BEHIND";

        } else {

          scheduleStatus =
            "ON_SCHEDULE";

        }

      }

      // =================================================
      // RESPONSE
      // =================================================

      return res.json({

        success: true,

        activity: {

          id:
            activity.id,

          project_id:
            activity.project_id,

          activity_code:
            activity.activity_code,

          activity_name:
            activity.activity_name,

          unit:
            activity.unit,

          planned_quantity:
            round(
              plannedQuantity
            ),

          completed_quantity:
            round(
              completedQuantity
            ),

          remaining_quantity:
            round(
              remainingQuantity
            ),

          progress_percent:
            round(
              progressPercent
            )

        },

        budget: {

          planned_unit_rate:
            round(
              plannedUnitRate
            ),

          budget_at_completion:
            round(
              budgetAtCompletion
            )

        },

        cost: {

          manpower_cost:
            round(
              actual.manpowerCost
            ),

          equipment_cost:
            round(
              actual.equipmentCost
            ),

          material_cost:
            round(
              actual.materialCost
            ),

          actual_cost:
            round(
              actualCost
            ),

          actual_cost_per_unit:
            completedQuantity > 0
              ? round(
                  actualCost /
                  completedQuantity
                )
              : 0

        },

        earned_value: {

          planned_value:
            plannedValue === null
              ? null
              : round(
                  plannedValue
                ),

          earned_value:
            round(
              earnedValue
            ),

          actual_cost:
            round(
              actualCost
            )

        },

        performance: {

          cost_variance:
            round(
              costVariance
            ),

          cost_performance_index:
            round(
              cpi
            ),

          schedule_variance:
            scheduleVariance === null
              ? null
              : round(
                  scheduleVariance
                ),

          schedule_performance_index:
            spi === null
              ? null
              : round(
                  spi
                ),

          estimate_at_completion:
            round(
              estimateAtCompletion
            ),

          estimate_to_complete:
            round(
              estimateToComplete
            ),

          variance_at_completion:
            round(
              varianceAtCompletion
            ),

          to_complete_performance_index:
            round(
              tcpi
            )

        },

        status: {

          cost_status:
            costStatus,

          schedule_status:
            scheduleStatus

        }

      });

    } catch (error) {

      console.error(
        "EVM calculation error:",
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

  }
);

// =====================================================
// EXPORT
// =====================================================

module.exports = router;

