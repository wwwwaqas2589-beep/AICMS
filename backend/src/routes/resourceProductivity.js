const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// GET ALL RESOURCE PRODUCTIVITY
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("resource_productivity")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error("GET RESOURCE PRODUCTIVITY ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch resource productivity",
        error: error.message
      });
    }

    return res.json({
      success: true,
      count: data ? data.length : 0,
      resource_productivity: data || []
    });

  } catch (error) {
    console.error("RESOURCE PRODUCTIVITY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});


// =====================================================
// GET RESOURCE PRODUCTIVITY BY ACTIVITY
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
      .from("resource_productivity")
      .select("*")
      .eq("activity_id", activityId)
      .order("id", { ascending: false });

    if (error) {
      console.error("ACTIVITY PRODUCTIVITY ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch activity resource productivity",
        error: error.message
      });
    }

    return res.json({
      success: true,
      activity_id: activityId,
      count: data ? data.length : 0,
      resource_productivity: data || []
    });

  } catch (error) {
    console.error("ACTIVITY PRODUCTIVITY SERVER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});


// =====================================================
// GET RESOURCE PRODUCTIVITY BY PROJECT
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
      .from("resource_productivity")
      .select("*")
      .eq("project_id", projectId)
      .order("id", { ascending: false });

    if (error) {
      console.error("PROJECT PRODUCTIVITY ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch project resource productivity",
        error: error.message
      });
    }

    return res.json({
      success: true,
      project_id: projectId,
      count: data ? data.length : 0,
      resource_productivity: data || []
    });

  } catch (error) {
    console.error("PROJECT PRODUCTIVITY SERVER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});


// =====================================================
// CREATE RESOURCE PRODUCTIVITY
// =====================================================

router.post("/", async (req, res) => {
  try {
    const {
      company_id,
      project_id,
      activity_id,
      resource_performance_id,
      resource_type,
      resource_code,
      resource_name,
      productivity_date,
      planned_quantity,
      actual_quantity,
      planned_hours,
      actual_hours,
      planned_rate,
      actual_rate,
      productivity_target,
      remarks
    } = req.body;


    // =================================================
    // VALIDATION
    // =================================================

    if (!project_id) {
      return res.status(400).json({
        success: false,
        message: "project_id is required"
      });
    }

    if (!activity_id) {
      return res.status(400).json({
        success: false,
        message: "activity_id is required"
      });
    }

    if (!resource_type) {
      return res.status(400).json({
        success: false,
        message: "resource_type is required"
      });
    }

    if (!productivity_date) {
      return res.status(400).json({
        success: false,
        message: "productivity_date is required"
      });
    }


    // =================================================
    // NUMERIC CONVERSION
    // =================================================

    const plannedQty = Number(planned_quantity || 0);
    const actualQty = Number(actual_quantity || 0);

    const plannedHours = Number(planned_hours || 0);
    const actualHours = Number(actual_hours || 0);

    const plannedRate = Number(planned_rate || 0);
    const actualRate = Number(actual_rate || 0);

    const target = Number(productivity_target || 0);


    // =================================================
    // COST
    // =================================================

    const plannedCost =
      plannedHours * plannedRate;

    const actualCost =
      actualHours * actualRate;


    // =================================================
    // ACTUAL PRODUCTIVITY
    // =================================================

    let actualProductivity = 0;

    if (actualHours > 0) {
      actualProductivity =
        actualQty / actualHours;
    }


    // =================================================
    // PRODUCTIVITY VARIANCE
    // =================================================

    const productivityVariance =
      actualProductivity - target;


    // =================================================
    // PRODUCTIVITY PERCENTAGE
    // =================================================

    let productivityPercentage = 0;

    if (target > 0) {
      productivityPercentage =
        (actualProductivity / target) * 100;
    }


    // =================================================
    // COST VARIANCE
    // =================================================

    const costVariance =
      plannedCost - actualCost;


    // =================================================
    // COST VARIANCE PERCENTAGE
    // =================================================

    let costVariancePercentage = 0;

    if (plannedCost > 0) {
      costVariancePercentage =
        (costVariance / plannedCost) * 100;
    }


    // =================================================
    // EFFICIENCY STATUS
    // =================================================

    let efficiencyStatus = "NO DATA";

    if (target > 0) {

      if (
        productivityPercentage >= 100 &&
        costVariance >= 0
      ) {
        efficiencyStatus = "EFFICIENT";

      } else if (
        productivityPercentage >= 90 &&
        costVariancePercentage >= -10
      ) {
        efficiencyStatus = "ACCEPTABLE";

      } else if (
        productivityPercentage >= 80
      ) {
        efficiencyStatus = "WARNING";

      } else {
        efficiencyStatus = "INEFFICIENT";
      }
    }


    // =================================================
    // INSERT DATABASE RECORD
    // =================================================

    const { data, error } = await supabase
      .from("resource_productivity")
      .insert([
        {
          company_id:
            company_id || null,

          project_id:
            project_id,

          activity_id:
            activity_id,

          resource_performance_id:
            resource_performance_id || null,

          resource_type:
            resource_type,

          resource_code:
            resource_code || null,

          resource_name:
            resource_name || null,

          productivity_date:
            productivity_date,

          planned_quantity:
            plannedQty,

          actual_quantity:
            actualQty,

          planned_hours:
            plannedHours,

          actual_hours:
            actualHours,

          planned_rate:
            plannedRate,

          actual_rate:
            actualRate,

          planned_cost:
            Number(plannedCost.toFixed(2)),

          actual_cost:
            Number(actualCost.toFixed(2)),

          productivity_target:
            target,

          actual_productivity:
            Number(
              actualProductivity.toFixed(3)
            ),

          productivity_variance:
            Number(
              productivityVariance.toFixed(3)
            ),

          productivity_percentage:
            Number(
              productivityPercentage.toFixed(3)
            ),

          cost_variance:
            Number(
              costVariance.toFixed(2)
            ),

          cost_variance_percentage:
            Number(
              costVariancePercentage.toFixed(3)
            ),

          efficiency_status:
            efficiencyStatus,

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
        "INSERT RESOURCE PRODUCTIVITY ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to create resource productivity",
        error:
          error.message
      });
    }


    // =================================================
    // SUCCESS
    // =================================================

    return res.status(201).json({
      success: true,
      message:
        "Resource productivity created successfully",
      productivity:
        data
    });

  } catch (error) {

    console.error(
      "CREATE RESOURCE PRODUCTIVITY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
      error:
        error.message
    });
  }
});


// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;