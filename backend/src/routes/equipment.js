const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// GET ALL EQUIPMENT
// GET /api/equipment
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("equipment_records")
      .select("*")
      .order("work_date", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch equipment records",
        error: error.message
      });
    }

    return res.json({
      success: true,
      count: data.length,
      equipment: data
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
// GET EQUIPMENT BY ID
// GET /api/equipment/:id
// =====================================================

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("equipment_records")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch equipment record",
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Equipment record not found"
      });
    }

    return res.json({
      success: true,
      equipment: data
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
// CREATE EQUIPMENT RECORD
// POST /api/equipment
// =====================================================

router.post("/", async (req, res) => {
  try {
    const {
      project_id,
      activity_id,
      work_date,
      equipment_name,
      equipment_code,
      operator_name,
      quantity,
      working_hours,
      idle_hours,
      breakdown_hours,
      fuel_consumption,
      hourly_rate,
      remarks
    } = req.body;

    // -------------------------------------------------
    // REQUIRED FIELDS
    // -------------------------------------------------

    if (
      !project_id ||
      !work_date ||
      !equipment_name
    ) {
      return res.status(400).json({
        success: false,
        message:
          "project_id, work_date and equipment_name are required"
      });
    }

    // -------------------------------------------------
    // CREATE EQUIPMENT RECORD
    // -------------------------------------------------

    const { data, error } = await supabase
      .from("equipment_records")
      .insert({
        project_id,
        activity_id: activity_id || null,
        work_date,
        equipment_name,
        equipment_code: equipment_code || null,
        operator_name: operator_name || null,
        quantity: quantity || 1,
        working_hours: working_hours || 0,
        idle_hours: idle_hours || 0,
        breakdown_hours: breakdown_hours || 0,
        fuel_consumption: fuel_consumption || 0,
        hourly_rate: hourly_rate || 0,
        remarks: remarks || null
      })
      .select("*")
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to create equipment record",
        error: error.message
      });
    }

    return res.status(201).json({
      success: true,
      message: "Equipment record created successfully",
      equipment: data
    });

  } catch (error) {
    console.error("Equipment error:", error);

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