const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// GET ALL PLANNING RECORDS
// GET /api/planning
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("project_planning")
      .select("*")
      .order("project_id", { ascending: true })
      .order("start_date", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch planning records",
        error: error.message
      });
    }

    return res.json({
      success: true,
      count: data.length,
      planning: data
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
// GET PLANNING BY PROJECT
// GET /api/planning/project/:project_id
// =====================================================

router.get("/project/:project_id", async (req, res) => {
  try {
    const { project_id } = req.params;

    const { data, error } = await supabase
      .from("project_planning")
      .select("*")
      .eq("project_id", project_id)
      .order("start_date", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch project planning",
        error: error.message
      });
    }

    return res.json({
      success: true,
      project_id: Number(project_id),
      count: data.length,
      planning: data
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
// GET PLANNING BY ACTIVITY
// GET /api/planning/activity/:activity_id
// =====================================================

router.get("/activity/:activity_id", async (req, res) => {
  try {
    const { activity_id } = req.params;

    const { data, error } = await supabase
      .from("project_planning")
      .select("*")
      .eq("activity_id", activity_id)
      .order("id", { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch activity planning",
        error: error.message
      });
    }

    return res.json({
      success: true,
      activity_id: Number(activity_id),
      count: data.length,
      planning: data
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
// CREATE PLANNING RECORD
// POST /api/planning
// =====================================================

router.post("/", async (req, res) => {
  try {
    const {
      company_id,
      project_id,
      activity_id,

      wbs_code,
      wbs_name,

      activity_code,
      activity_name,

      description,
      unit,

      planned_quantity,

      start_date,
      finish_date,

      planned_duration,

      planned_manpower,
      planned_equipment,

      budget_quantity,
      budget_cost,

      planned_progress,
      actual_progress,

      baseline_start_date,
      baseline_finish_date,

      status,
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

    if (!activity_name) {
      return res.status(400).json({
        success: false,
        message: "activity_name is required"
      });
    }


    // =================================================
    // INSERT
    // =================================================

    const { data, error } = await supabase
      .from("project_planning")
      .insert([
        {
          company_id: company_id || null,
          project_id: Number(project_id),
          activity_id: activity_id
            ? Number(activity_id)
            : null,

          wbs_code: wbs_code || null,
          wbs_name: wbs_name || null,

          activity_code: activity_code || null,
          activity_name,

          description: description || null,
          unit: unit || null,

          planned_quantity:
            Number(planned_quantity || 0),

          start_date: start_date || null,
          finish_date: finish_date || null,

          planned_duration:
            Number(planned_duration || 0),

          planned_manpower:
            Number(planned_manpower || 0),

          planned_equipment:
            Number(planned_equipment || 0),

          budget_quantity:
            Number(budget_quantity || 0),

          budget_cost:
            Number(budget_cost || 0),

          planned_progress:
            Number(planned_progress || 0),

          actual_progress:
            Number(actual_progress || 0),

          baseline_start_date:
            baseline_start_date || null,

          baseline_finish_date:
            baseline_finish_date || null,

          status: status || "PLANNED",

          remarks: remarks || null
        }
      ])
      .select("*")
      .single();


    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to create planning record",
        error: error.message
      });
    }


    return res.status(201).json({
      success: true,
      message: "Planning record created successfully",
      planning: data
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
// UPDATE PLANNING RECORD
// PATCH /api/planning/:id
// =====================================================

router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const allowedFields = [
      "company_id",
      "project_id",
      "activity_id",

      "wbs_code",
      "wbs_name",

      "activity_code",
      "activity_name",

      "description",
      "unit",

      "planned_quantity",

      "start_date",
      "finish_date",

      "planned_duration",

      "planned_manpower",
      "planned_equipment",

      "budget_quantity",
      "budget_cost",

      "planned_progress",
      "actual_progress",

      "baseline_start_date",
      "baseline_finish_date",

      "status",
      "remarks"
    ];


    const updateData = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }


    updateData.updated_at = new Date().toISOString();


    const { data, error } = await supabase
      .from("project_planning")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();


    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to update planning record",
        error: error.message
      });
    }


    return res.json({
      success: true,
      message: "Planning record updated successfully",
      planning: data
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
// DELETE PLANNING RECORD
// DELETE /api/planning/:id
// =====================================================

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("project_planning")
      .delete()
      .eq("id", id);

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete planning record",
        error: error.message
      });
    }

    return res.json({
      success: true,
      message: "Planning record deleted successfully"
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
// EXPORT
// =====================================================

module.exports = router;