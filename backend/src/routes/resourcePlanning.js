const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");


// =====================================================
// GET ALL RESOURCE PLANNING
// =====================================================

router.get("/", async (req, res) => {
  try {

    const { data, error } = await supabase
      .from("activity_resource_planning")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch resource planning",
        error: error.message
      });
    }

    return res.json({
      success: true,
      count: data.length,
      resource_planning: data
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Failed to fetch resource planning",
      error: error.message
    });

  }
});


// =====================================================
// GET RESOURCE PLANNING BY PROJECT
// =====================================================

router.get("/project/:projectId", async (req, res) => {
  try {

    const projectId = Number(req.params.projectId);

    const { data, error } = await supabase
      .from("activity_resource_planning")
      .select("*")
      .eq("project_id", projectId)
      .order("activity_id", { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch project resource planning",
        error: error.message
      });
    }

    return res.json({
      success: true,
      project_id: projectId,
      count: data.length,
      resource_planning: data
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Failed to fetch project resource planning",
      error: error.message
    });

  }
});


// =====================================================
// GET RESOURCE PLANNING BY ACTIVITY
// =====================================================

router.get("/activity/:activityId", async (req, res) => {
  try {

    const activityId = Number(req.params.activityId);

    const { data, error } = await supabase
      .from("activity_resource_planning")
      .select("*")
      .eq("activity_id", activityId)
      .order("resource_type", { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch activity resources",
        error: error.message
      });
    }

    return res.json({
      success: true,
      activity_id: activityId,
      count: data.length,
      resources: data
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Failed to fetch activity resources",
      error: error.message
    });

  }
});


// =====================================================
// CREATE RESOURCE PLANNING
// =====================================================

router.post("/", async (req, res) => {
  try {

    const body = req.body;

    const plannedQuantity =
      Number(body.planned_quantity || 0);

    const plannedHours =
      Number(body.planned_hours || 0);

    const plannedRate =
      Number(body.planned_rate || 0);

    const plannedCost =
      body.planned_cost !== undefined
        ? Number(body.planned_cost)
        : plannedHours * plannedRate;


    const actualQuantity =
      Number(body.actual_quantity || 0);

    const actualHours =
      Number(body.actual_hours || 0);

    const actualRate =
      Number(body.actual_rate || 0);

    const actualCost =
      body.actual_cost !== undefined
        ? Number(body.actual_cost)
        : actualHours * actualRate;


    const productivityTarget =
      Number(body.productivity_target || 0);

    const actualProductivity =
      actualHours > 0
        ? actualQuantity / actualHours
        : 0;


    const record = {

      company_id:
        body.company_id || null,

      project_id:
        Number(body.project_id),

      activity_id:
        Number(body.activity_id),

      resource_type:
        body.resource_type,

      resource_id:
        body.resource_id
          ? Number(body.resource_id)
          : null,

      resource_code:
        body.resource_code || null,

      resource_name:
        body.resource_name,

      planned_quantity:
        plannedQuantity,

      planned_hours:
        plannedHours,

      planned_rate:
        plannedRate,

      planned_cost:
        Number(plannedCost.toFixed(2)),

      actual_quantity:
        actualQuantity,

      actual_hours:
        actualHours,

      actual_rate:
        actualRate,

      actual_cost:
        Number(actualCost.toFixed(2)),

      productivity_target:
        productivityTarget,

      actual_productivity:
        Number(
          actualProductivity.toFixed(3)
        ),

      status:
        body.status || "PLANNED",

      remarks:
        body.remarks || null
    };


    const {
      data,
      error
    } = await supabase
      .from("activity_resource_planning")
      .insert(record)
      .select()
      .single();


    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to create resource planning",
        error: error.message
      });
    }


    return res.status(201).json({

      success: true,

      message:
        "Resource planning created successfully",

      resource:
        data

    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Failed to create resource planning",
      error: error.message
    });

  }
});


// =====================================================
// UPDATE RESOURCE PLANNING
// =====================================================

router.put("/:id", async (req, res) => {
  try {

    const id = Number(req.params.id);

    const body = req.body;

    const updateData = {
      ...body,
      updated_at: new Date().toISOString()
    };


    if (
      body.actual_quantity !== undefined ||
      body.actual_hours !== undefined
    ) {

      const actualQuantity =
        Number(body.actual_quantity || 0);

      const actualHours =
        Number(body.actual_hours || 0);

      updateData.actual_productivity =
        actualHours > 0
          ? Number(
              (
                actualQuantity /
                actualHours
              ).toFixed(3)
            )
          : 0;

    }


    const {
      data,
      error
    } = await supabase
      .from("activity_resource_planning")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();


    if (error) {

      return res.status(500).json({
        success: false,
        message: "Failed to update resource planning",
        error: error.message
      });

    }


    return res.json({

      success: true,

      message:
        "Resource planning updated successfully",

      resource:
        data

    });

  } catch (error) {

    return res.status(500).json({

      success: false,

      message:
        "Failed to update resource planning",

      error:
        error.message

    });

  }
});


module.exports = router;