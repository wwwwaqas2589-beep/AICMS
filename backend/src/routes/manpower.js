const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// GET ALL MANPOWER
// GET /api/manpower
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("manpower_records")
      .select("*")
      .order("work_date", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch manpower records",
        error: error.message
      });
    }

    return res.json({
      success: true,
      count: data.length,
      manpower: data
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
// GET MANPOWER BY ID
// GET /api/manpower/:id
// =====================================================

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("manpower_records")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch manpower record",
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Manpower record not found"
      });
    }

    return res.json({
      success: true,
      manpower: data
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
// CREATE MANPOWER
// POST /api/manpower
// =====================================================

router.post("/", async (req, res) => {
  try {
    const {
      project_id,
      activity_id,
      work_date,
      employee_name,
      role,
      worker_count,
      regular_hours,
      overtime_hours,
      hourly_rate,
      remarks
    } = req.body;

    // -------------------------------------------------
    // REQUIRED FIELDS
    // -------------------------------------------------

    if (
      !project_id ||
      !work_date ||
      !employee_name
    ) {
      return res.status(400).json({
        success: false,
        message:
          "project_id, work_date and employee_name are required"
      });
    }

    // -------------------------------------------------
    // CREATE RECORD
    // -------------------------------------------------

    const { data, error } = await supabase
      .from("manpower_records")
      .insert({
        project_id,
        activity_id: activity_id || null,
        work_date,
        employee_name,
        role: role || null,
        worker_count: worker_count || 1,
        regular_hours: regular_hours || 0,
        overtime_hours: overtime_hours || 0,
        hourly_rate: hourly_rate || 0,
        remarks: remarks || null
      })
      .select("*")
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to create manpower record",
        error: error.message
      });
    }

    return res.status(201).json({
      success: true,
      message: "Manpower record created successfully",
      manpower: data
    });

  } catch (error) {
    console.error("Manpower error:", error);

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