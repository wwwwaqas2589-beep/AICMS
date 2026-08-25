const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// GET ALL WORK ACTIVITIES
// GET /api/work-activities
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("work_activities")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch work activities",
        error: error.message
      });
    }

    return res.json({
      success: true,
      count: data.length,
      activities: data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});


// =====================================================
// GET WORK ACTIVITY BY ID
// GET /api/work-activities/:id
// =====================================================

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("work_activities")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch work activity",
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Work activity not found"
      });
    }

    // =================================================
    // FINANCIAL CALCULATIONS
    // =================================================

    const plannedQuantity =
      Number(data.planned_quantity || 0);

    const plannedCost =
      Number(data.planned_cost || 0);

    const plannedUnitRate =
      plannedQuantity > 0
        ? plannedCost / plannedQuantity
        : 0;

    const plannedTotalCost =
      plannedCost;

    const activity = {
      ...data,

      planned_unit_rate:
        Number(plannedUnitRate.toFixed(2)),

      planned_total_cost:
        Number(plannedTotalCost.toFixed(2))
    };

    return res.json({
      success: true,
      activity
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});


// =====================================================
// CREATE WORK ACTIVITY
// POST /api/work-activities
// =====================================================

router.post("/", async (req, res) => {
  try {
    const {
      project_id,
      activity_code,
      activity_name,
      description,
      unit,
      planned_quantity,
      completed_quantity,
      status,
      required_manpower,
      required_equipment,
      required_materials,
      planned_hours,
      actual_hours,
      planned_cost,
      actual_cost
    } = req.body;

    if (!project_id || !activity_code || !activity_name || !unit) {
      return res.status(400).json({
        success: false,
        message: "project_id, activity_code, activity_name and unit are required"
      });
    }

    const { data, error } = await supabase
      .from("work_activities")
      .insert({
        project_id,
        activity_code,
        activity_name,
        description,
        unit,
        planned_quantity: planned_quantity || 0,
        completed_quantity: completed_quantity || 0,
        status: status || "planned",
        required_manpower: required_manpower || 0,
        required_equipment: required_equipment || 0,
        required_materials,
        planned_hours: planned_hours || 0,
        actual_hours: actual_hours || 0,
        planned_cost: planned_cost || 0,
        actual_cost: actual_cost || 0
      })
      .select("*")
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to create work activity",
        error: error.message
      });
    }

    return res.status(201).json({
      success: true,
      message: "Work activity created successfully",
      activity: data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});


// =====================================================
// UPDATE WORK ACTIVITY
// PUT /api/work-activities/:id
// =====================================================

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      activity_name,
      description,
      planned_quantity,
      completed_quantity,
      status,
      required_manpower,
      required_equipment,
      required_materials,
      planned_hours,
      actual_hours,
      planned_cost,
      actual_cost
    } = req.body;

    const updateData = {};

    if (activity_name !== undefined)
      updateData.activity_name = activity_name;

    if (description !== undefined)
      updateData.description = description;

    if (planned_quantity !== undefined)
      updateData.planned_quantity = planned_quantity;

    if (completed_quantity !== undefined)
      updateData.completed_quantity = completed_quantity;

    if (status !== undefined)
      updateData.status = status;

    if (required_manpower !== undefined)
      updateData.required_manpower = required_manpower;

    if (required_equipment !== undefined)
      updateData.required_equipment = required_equipment;

    if (required_materials !== undefined)
      updateData.required_materials = required_materials;

    if (planned_hours !== undefined)
  updateData.planned_hours = planned_hours;

    if (actual_hours !== undefined)
      updateData.actual_hours = actual_hours;

    if (planned_cost !== undefined)
      updateData.planned_cost = planned_cost;

    if (actual_cost !== undefined)
      updateData.actual_cost = actual_cost;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields provided for update"
      });
    }

    const { data, error } = await supabase
      .from("work_activities")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to update work activity",
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Work activity not found"
      });
    }

    return res.json({
      success: true,
      message: "Work activity updated successfully",
      activity: data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});


// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;

