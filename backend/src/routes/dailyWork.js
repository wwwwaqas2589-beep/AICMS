const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// INTEGRATED DAILY WORK
// POST /api/daily-work
//
// Flow:
// Project
//   -> Activity
//   -> Daily Production
//   -> Daily Cost
//   -> Planning Control / EVM
// =====================================================

router.post("/", async (req, res) => {
  try {
    const {
      project_id,
      activity_id,
      work_date,
      today_quantity,
      manpower,
      equipment,
      working_hours,
      manpower_cost,
      equipment_cost,
      material_cost,
      remarks
    } = req.body;

    // =================================================
    // VALIDATION
    // =================================================

    if (
      !project_id ||
      !activity_id ||
      !work_date ||
      today_quantity === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "project_id, activity_id, work_date and today_quantity are required"
      });
    }

    const projectId = Number(project_id);
    const activityId = Number(activity_id);

    const quantity = Number(today_quantity);
    const manpowerCount = Number(manpower || 0);
    const equipmentCount = Number(equipment || 0);
    const workingHours = Number(working_hours || 0);

    const manpowerCost = Number(manpower_cost || 0);
    const equipmentCost = Number(equipment_cost || 0);
    const materialCost = Number(material_cost || 0);

    // =================================================
    // NUMBER VALIDATION
    // =================================================

    if (
      !Number.isFinite(projectId) ||
      !Number.isFinite(activityId)
    ) {
      return res.status(400).json({
        success: false,
        message: "project_id and activity_id must be valid numbers"
      });
    }

    if (
      quantity < 0 ||
      manpowerCount < 0 ||
      equipmentCount < 0 ||
      workingHours < 0 ||
      manpowerCost < 0 ||
      equipmentCost < 0 ||
      materialCost < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Quantity, resources and cost values cannot be negative"
      });
    }

    // =================================================
    // CHECK PROJECT
    // =================================================

    const {
      data: project,
      error: projectError
    } = await supabase
      .from("projects")
      .select("id, project_code, project_name")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError) {
      return res.status(500).json({
        success: false,
        message: "Failed to check project",
        error: projectError.message
      });
    }

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found"
      });
    }

    // =================================================
    // CHECK ACTIVITY
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
        message: "Failed to check work activity",
        error: activityError.message
      });
    }

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Work activity not found"
      });
    }

    // =================================================
    // CHECK PROJECT / ACTIVITY RELATION
    // =================================================

    if (
      activity.project_id !== undefined &&
      activity.project_id !== null &&
      Number(activity.project_id) !== projectId
    ) {
      return res.status(400).json({
        success: false,
        message: "Activity does not belong to selected project"
      });
    }

    // =================================================
    // CHECK PLANNED QUANTITY
    // =================================================

    const plannedQuantity =
      Number(activity.planned_quantity || 0);

    // =================================================
    // CHECK EXISTING DAILY PRODUCTION
    // =================================================

    const {
      data: existingProduction,
      error: productionCheckError
    } = await supabase
      .from("daily_production")
      .select("id")
      .eq("project_id", projectId)
      .eq("activity_id", activityId)
      .eq("production_date", work_date)
      .maybeSingle();

    if (productionCheckError) {
      return res.status(500).json({
        success: false,
        message: "Failed to check existing daily production",
        error: productionCheckError.message
      });
    }

    if (existingProduction) {
      return res.status(409).json({
        success: false,
        message:
          "Daily production already exists for this project, activity and date",
        production_id: existingProduction.id
      });
    }

    // =================================================
    // CREATE DAILY PRODUCTION
    // =================================================

    const {
      data: production,
      error: productionError
    } = await supabase
      .from("daily_production")
      .insert({
        project_id: projectId,
        activity_id: activityId,
        production_date: work_date,
        today_quantity: quantity,
        manpower: manpowerCount,
        equipment: equipmentCount,
        working_hours: workingHours,
        remarks: remarks || null
      })
      .select("*")
      .single();

    if (productionError) {
      return res.status(500).json({
        success: false,
        message: "Failed to create daily production",
        error: productionError.message
      });
    }

    // =================================================
    // TOTAL DAILY COST
    // =================================================

    const totalCost =
      manpowerCost +
      equipmentCost +
      materialCost;

    // =================================================
    // CREATE DAILY COST
    // =================================================

    const {
      data: dailyCost,
      error: costError
    } = await supabase
      .from("daily_costs")
      .insert({
        project_id: projectId,
        activity_id: activityId,
        cost_date: work_date,
        manpower_cost: Number(manpowerCost.toFixed(2)),
        equipment_cost: Number(equipmentCost.toFixed(2)),
        material_cost: Number(materialCost.toFixed(2)),
        remarks:
          remarks ||
          "Integrated daily work cost"
      })
      .select("*")
      .single();

    // =================================================
    // COST INSERT FAILED
    // =================================================

    if (costError) {

      // Remove production created above so we do not leave
      // an incomplete Daily Work record.

      await supabase
        .from("daily_production")
        .delete()
        .eq("id", production.id);

      return res.status(500).json({
        success: false,
        message:
          "Daily cost failed, daily production was rolled back",
        error: costError.message
      });
    }

    // =================================================
    // CALCULATE BASIC DAILY PRODUCTIVITY
    // =================================================

    let productivityPerHour = 0;

    if (workingHours > 0) {
      productivityPerHour =
        quantity / workingHours;
    }

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(201).json({

      success: true,

      message:
        "Integrated daily work created successfully",

      project: {
        id: project.id,
        project_code: project.project_code,
        project_name: project.project_name
      },

      activity: {
        id: activity.id,
        activity_code: activity.activity_code,
        activity_name: activity.activity_name,
        unit: activity.unit,
        planned_quantity: plannedQuantity
      },

      daily_work: {
        work_date: work_date,
        today_quantity: quantity,
        manpower: manpowerCount,
        equipment: equipmentCount,
        working_hours: workingHours,
        productivity_per_hour:
          Number(productivityPerHour.toFixed(2)),
        remarks: remarks || null
      },

      production: production,

      cost: {
        manpower_cost:
          Number(manpowerCost.toFixed(2)),
        equipment_cost:
          Number(equipmentCost.toFixed(2)),
        material_cost:
          Number(materialCost.toFixed(2)),
        total_cost:
          Number(totalCost.toFixed(2))
      },

      daily_cost: dailyCost,

      integration: {
        production_created: true,
        cost_created: true,
        planning_control:
          "/api/planning-control/project/" + projectId
      }

    });

  } catch (error) {

    console.error(
      "Integrated daily work error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});


// =====================================================
// GET ALL INTEGRATED DAILY WORK
// GET /api/daily-work
// =====================================================

router.get("/", async (req, res) => {
  try {

    const {
      data: production,
      error
    } = await supabase
      .from("daily_production")
      .select("*")
      .order("production_date", {
        ascending: false
      })
      .order("id", {
        ascending: false
      });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch daily work",
        error: error.message
      });
    }

    return res.json({
      success: true,
      count: production.length,
      daily_work: production
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