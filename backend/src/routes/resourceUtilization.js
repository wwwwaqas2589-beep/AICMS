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
// GET BY PROJECT
// =====================================================

router.get("/project/:projectId", async (req, res) => {
  try {

    const projectId = Number(req.params.projectId);

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
// GET BY ACTIVITY
// =====================================================

router.get("/activity/:activityId", async (req, res) => {
  try {

    const activityId = Number(req.params.activityId);

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
      planned_cost,
      actual_cost,
      productivity_actual,
      productivity_variance,
      status,
      remarks
    } = req.body;


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


    const calculatedPlannedCost =
      planned_cost !== undefined
        ? Number(planned_cost)
        : finalPlannedQuantity * finalPlannedRate;


    const calculatedActualCost =
      actual_cost !== undefined
        ? Number(actual_cost)
        : finalActualQuantity * finalActualRate;


    const quantityVariance =
      finalActualQuantity - finalPlannedQuantity;


    const hoursVariance =
      finalActualHours - finalPlannedHours;


    const costVariance =
      calculatedActualCost - calculatedPlannedCost;


    const utilizationPercent =
      finalPlannedQuantity > 0
        ? (finalActualQuantity / finalPlannedQuantity) * 100
        : 0;


    const { data, error } = await supabase
      .from("resource_utilization")
      .insert([
        {
          company_id,
          project_id,
          activity_id,
          resource_planning_id,

          resource_type,
          resource_code,
          resource_name,

          utilization_date,

          planned_quantity: finalPlannedQuantity,
          actual_quantity: finalActualQuantity,

          planned_hours: finalPlannedHours,
          actual_hours: finalActualHours,

          planned_rate: finalPlannedRate,
          actual_rate: finalActualRate,

          planned_cost: calculatedPlannedCost,
          actual_cost: calculatedActualCost,

          quantity_variance: quantityVariance,
          hours_variance: hoursVariance,
          cost_variance: costVariance,

          utilization_percent: utilizationPercent,

          productivity_actual:
            Number(productivity_actual || 0),

          productivity_variance:
            Number(productivity_variance || 0),

          status: status || "OPEN",
          remarks
        }
      ])
      .select()
      .single();


    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to create resource utilization",
        error: error.message
      });
    }


    return res.status(201).json({
      success: true,
      message: "Resource utilization created successfully",
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
// EXPORT ROUTER
// =====================================================

module.exports = router;