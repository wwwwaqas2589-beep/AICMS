const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// GET ALL DAILY COSTS
// GET /api/daily-costs
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("daily_costs")
      .select("*")
      .order("cost_date", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch daily costs",
        error: error.message
      });
    }

    return res.json({
      success: true,
      count: data.length,
      costs: data
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
// GET DAILY COST BY PROJECT + DATE
// GET /api/daily-costs/project/:project_id/:date
// =====================================================

router.get("/project/:project_id/:date", async (req, res) => {
  try {
    const { project_id, date } = req.params;

    const { data, error } = await supabase
      .from("daily_costs")
      .select("*")
      .eq("project_id", project_id)
      .eq("cost_date", date)
      .order("id", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch project daily cost",
        error: error.message
      });
    }

    const total = data.reduce(
      (sum, item) => sum + Number(item.total_cost || 0),
      0
    );

    return res.json({
      success: true,
      project_id: Number(project_id),
      cost_date: date,
      count: data.length,
      total_cost: Number(total.toFixed(2)),
      costs: data
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
// GET ACTIVITY COST
// GET /api/daily-costs/activity/:activity_id
// =====================================================

router.get("/activity/:activity_id", async (req, res) => {
  try {
    const { activity_id } = req.params;

    const { data, error } = await supabase
      .from("daily_costs")
      .select("*")
      .eq("activity_id", activity_id)
      .order("cost_date", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch activity cost",
        error: error.message
      });
    }

    const manpowerCost = data.reduce(
      (sum, item) => sum + Number(item.manpower_cost || 0),
      0
    );

    const equipmentCost = data.reduce(
      (sum, item) => sum + Number(item.equipment_cost || 0),
      0
    );

    const materialCost = data.reduce(
      (sum, item) => sum + Number(item.material_cost || 0),
      0
    );

    const totalCost =
      manpowerCost +
      equipmentCost +
      materialCost;

    return res.json({
      success: true,
      activity_id: Number(activity_id),
      summary: {
        manpower_cost: Number(manpowerCost.toFixed(2)),
        equipment_cost: Number(equipmentCost.toFixed(2)),
        material_cost: Number(materialCost.toFixed(2)),
        total_cost: Number(totalCost.toFixed(2))
      },
      costs: data
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
// CREATE DAILY COST
// POST /api/daily-costs
// =====================================================

router.post("/", async (req, res) => {
  try {
    const {
      project_id,
      activity_id,
      cost_date,
      manpower_cost,
      equipment_cost,
      material_cost,
      remarks
    } = req.body;

    if (
      !project_id ||
      !cost_date
    ) {
      return res.status(400).json({
        success: false,
        message: "project_id and cost_date are required"
      });
    }

    const manpower = Number(manpower_cost || 0);
    const equipment = Number(equipment_cost || 0);
    const material = Number(material_cost || 0);

    if (
      manpower < 0 ||
      equipment < 0 ||
      material < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Cost values cannot be negative"
      });
    }

    const totalCost =
      manpower +
      equipment +
      material;

    const { data, error } = await supabase
      .from("daily_costs")
      .insert({
        project_id,
        activity_id: activity_id || null,
        cost_date,
        manpower_cost: manpower,
        equipment_cost: equipment,
        material_cost: material,
        remarks: remarks || null
      })
      .select("*")
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to create daily cost",
        error: error.message
      });
    }

    return res.status(201).json({
      success: true,
      message: "Daily cost created successfully",
      cost: {
        ...data,
        calculated_total_cost: Number(totalCost.toFixed(2))
      }
    });

  } catch (error) {
    console.error("Daily cost error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});


// =====================================================
// DELETE DAILY COST
// DELETE /api/daily-costs/:id
// =====================================================

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("daily_costs")
      .delete()
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete daily cost",
        error: error.message
      });
    }

    return res.json({
      success: true,
      message: "Daily cost deleted successfully",
      cost: data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});


module.exports = router;