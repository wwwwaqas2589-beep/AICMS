const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// GET ALL RESOURCE UTILIZATION
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("resource_utilization")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch resource utilization",
        error: error.message
      });
    }

    return res.json({
      success: true,
      count: data.length,
      resource_utilization: data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// =====================================================
// GET RESOURCE UTILIZATION BY PROJECT
// =====================================================

router.get("/project/:projectId", async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);

    if (!Number.isInteger(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID"
      });
    }

    const { data, error } = await supabase
      .from("resource_utilization")
      .select("*")
      .eq("project_id", projectId)
      .order("utilization_date", { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch project resource utilization",
        error: error.message
      });
    }

    return res.json({
      success: true,
      project_id: projectId,
      count: data.length,
      resource_utilization: data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// =====================================================
// GET RESOURCE UTILIZATION BY ACTIVITY
// =====================================================

router.get("/activity/:activityId", async (req, res) => {
  try {
    const activityId = Number(req.params.activityId);

    if (!Number.isInteger(activityId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid activity ID"
      });
    }

    const { data, error } = await supabase
      .from("resource_utilization")
      .select("*")
      .eq("activity_id", activityId)
      .order("utilization_date", { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch activity resource utilization",
        error: error.message
      });
    }

    return res.json({
      success: true,
      activity_id: activityId,
      count: data.length,
      resource_utilization: data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// =====================================================
// CREATE RESOURCE UTILIZATION
// =====================================================

router.post("/", async (req, res) => {
  try {
    const {
      company_id,
      project_id,
      activity_id,
      resource_planning_id,

      resource_type,
      resource_code,
      resource_name,

      utilization_date,

      planned_quantity,
      actual_quantity,

      planned_hours,
      actual_hours,

      planned_rate,
      actual_rate,

      productivity_actual,
      productivity_variance,

      status,
      remarks
    } = req.body;

    // =================================================
    // VALIDATION
    // =================================================

    if (
      project_id === undefined ||
      activity_id === undefined ||
      !resource_type ||
      !utilization_date
    ) {
      return res.status(400).json({
        success: false,
        message:
          "project_id, activity_id, resource_type and utilization_date are required"
      });
    }

    const finalProjectId = Number(project_id);
    const finalActivityId = Number(activity_id);

    if (
      !Number.isInteger(finalProjectId) ||
      !Number.isInteger(finalActivityId)
    ) {
      return res.status(400).json({
        success: false,
        message: "project_id and activity_id must be valid integers"
      });
    }

    // =================================================
    // RESOURCE TYPE
    // =================================================

    const normalizedResourceType =
      String(resource_type).trim().toUpperCase();

    const allowedResourceTypes = [
      "MANPOWER",
      "EQUIPMENT",
      "MATERIAL"
    ];

    if (!allowedResourceTypes.includes(normalizedResourceType)) {
      return res.status(400).json({
        success: false,
        message:
          "resource_type must be MANPOWER, EQUIPMENT or MATERIAL"
      });
    }

    // =================================================
    // NUMERIC VALUES
    // =================================================

    const finalPlannedQuantity =
      Number(planned_quantity || 0);

    const finalActualQuantity =
      Number(actual_quantity || 0);

    const finalPlannedHours =
      Number(planned_hours || 0);

    const finalActualHours =
      Number(actual_hours || 0);

    const finalPlannedRate =
      Number(planned_rate || 0);

    const finalActualRate =
      Number(actual_rate || 0);

    // =================================================
    // VALIDATE NUMBERS
    // =================================================

    const numericValues = [
      finalPlannedQuantity,
      finalActualQuantity,
      finalPlannedHours,
      finalActualHours,
      finalPlannedRate,
      finalActualRate
    ];

    if (numericValues.some((value) => !Number.isFinite(value))) {
      return res.status(400).json({
        success: false,
        message: "Invalid numeric value in resource utilization data"
      });
    }

    // =================================================
    // COST CALCULATION
    //
    // MANPOWER  = HOURS × HOURLY RATE
    // EQUIPMENT = HOURS × HOURLY RATE
    // MATERIAL  = QUANTITY × UNIT RATE
    // =================================================

    let calculatedPlannedCost = 0;
    let calculatedActualCost = 0;

    if (
      normalizedResourceType === "MANPOWER" ||
      normalizedResourceType === "EQUIPMENT"
    ) {
      calculatedPlannedCost =
        finalPlannedHours * finalPlannedRate;

      calculatedActualCost =
        finalActualHours * finalActualRate;
    }

    if (normalizedResourceType === "MATERIAL") {
      calculatedPlannedCost =
        finalPlannedQuantity * finalPlannedRate;

      calculatedActualCost =
        finalActualQuantity * finalActualRate;
    }

    // =================================================
    // VARIANCES
    // =================================================

    const quantityVariance =
      finalActualQuantity - finalPlannedQuantity;

    const hoursVariance =
      finalActualHours - finalPlannedHours;

    const costVariance =
      calculatedActualCost - calculatedPlannedCost;

    // =================================================
    // UTILIZATION %
    // =================================================

    let utilizationPercent = 0;

    if (
      normalizedResourceType === "MANPOWER" ||
      normalizedResourceType === "EQUIPMENT"
    ) {
      if (finalPlannedHours > 0) {
        utilizationPercent =
          (finalActualHours / finalPlannedHours) * 100;
      }
    } else {
      if (finalPlannedQuantity > 0) {
        utilizationPercent =
          (finalActualQuantity / finalPlannedQuantity) * 100;
      }
    }

    // =================================================
    // ROUNDING
    // =================================================

    const round2 = (value) => {
      return Number(Number(value || 0).toFixed(2));
    };

    const round3 = (value) => {
      return Number(Number(value || 0).toFixed(3));
    };

    // =================================================
    // INSERT INTO SUPABASE
    // =================================================

    const { data, error } = await supabase
      .from("resource_utilization")
      .insert([
        {
          company_id:
            company_id !== undefined && company_id !== null
              ? Number(company_id)
              : null,

          project_id:
            finalProjectId,

          activity_id:
            finalActivityId,

          resource_planning_id:
            resource_planning_id !== undefined &&
            resource_planning_id !== null &&
            resource_planning_id !== ""
              ? Number(resource_planning_id)
              : null,

          resource_type:
            normalizedResourceType,

          resource_code:
            resource_code || null,

          resource_name:
            resource_name || null,

          utilization_date,

          planned_quantity:
            round2(finalPlannedQuantity),

          actual_quantity:
            round2(finalActualQuantity),

          planned_hours:
            round2(finalPlannedHours),

          actual_hours:
            round2(finalActualHours),

          planned_rate:
            round2(finalPlannedRate),

          actual_rate:
            round2(finalActualRate),

          planned_cost:
            round2(calculatedPlannedCost),

          actual_cost:
            round2(calculatedActualCost),

          quantity_variance:
            round2(quantityVariance),

          hours_variance:
            round2(hoursVariance),

          cost_variance:
            round2(costVariance),

          utilization_percent:
            round2(utilizationPercent),

          productivity_actual:
            round3(productivity_actual || 0),

          productivity_variance:
            round3(productivity_variance || 0),

          status:
            status || "OPEN",

          remarks:
            remarks || null
        }
      ])
      .select()
      .single();

    // =================================================
    // DATABASE ERROR
    // =================================================

    if (error) {
      console.error(
        "Resource utilization database error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to create resource utilization",
        error: error.message
      });
    }

    // =================================================
    // SUCCESS
    // =================================================

    return res.status(201).json({
      success: true,
      message:
        "Resource utilization created successfully",
      resource_utilization:
        data
    });

  } catch (error) {
    console.error(
      "Resource utilization server error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
      error: error.message
    });
  }
});

// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;