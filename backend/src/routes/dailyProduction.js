const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// GET ALL DAILY PRODUCTION
// GET /api/daily-production
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("daily_production")
      .select("*")
      .order("production_date", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch daily production",
        error: error.message
      });
    }

    return res.json({
      success: true,
      count: data.length,
      production: data
    });

  } catch (error) {
    console.error("Get daily production error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});


// =====================================================
// GET DAILY PRODUCTION BY ID
// GET /api/daily-production/:id
// =====================================================

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("daily_production")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch daily production",
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Daily production not found"
      });
    }

    return res.json({
      success: true,
      production: data
    });

  } catch (error) {
    console.error("Get daily production by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});


// =====================================================
// CREATE DAILY PRODUCTION
// POST /api/daily-production
// =====================================================

router.post("/", async (req, res) => {
  try {
    const {
      project_id,
      activity_id,
      production_date,
      today_quantity,
      manpower,
      equipment,
      working_hours,
      remarks
    } = req.body;


    // =================================================
    // VALIDATION
    // =================================================

    if (
      !project_id ||
      !activity_id ||
      today_quantity === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "project_id, activity_id and today_quantity are required"
      });
    }


    // =================================================
    // VALIDATE QUANTITY
    // =================================================

    const productionQuantity = Number(today_quantity);

    if (
      !Number.isFinite(productionQuantity) ||
      productionQuantity < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "today_quantity must be a valid non-negative number"
      });
    }


    // =================================================
    // GET WORK ACTIVITY
    // =================================================

    const { data: activity, error: activityError } =
      await supabase
        .from("work_activities")
        .select("*")
        .eq("id", activity_id)
        .eq("project_id", project_id)
        .maybeSingle();

    if (activityError) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch work activity",
        error: activityError.message
      });
    }

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Work activity not found for this project"
      });
    }


    // =================================================
    // CHECK PLANNED QUANTITY
    // =================================================

    const plannedQuantity =
      Number(activity.planned_quantity || 0);

    if (plannedQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message:
          "Work activity must have a planned quantity greater than zero"
      });
    }


    // =================================================
    // GET EXISTING DAILY PRODUCTION
    //
    // IMPORTANT:
    // Completed quantity is calculated from the
    // production records, not from the old activity value.
    // =================================================

    const { data: existingProduction, error: productionFetchError } =
      await supabase
        .from("daily_production")
        .select("today_quantity")
        .eq("project_id", project_id)
        .eq("activity_id", activity_id);

    if (productionFetchError) {
      return res.status(500).json({
        success: false,
        message:
          "Failed to calculate existing production",
        error: productionFetchError.message
      });
    }


    // =================================================
    // EXISTING PRODUCTION TOTAL
    // =================================================

    const existingCompleted =
      (existingProduction || []).reduce(
        (sum, item) =>
          sum + Number(item.today_quantity || 0),
        0
      );


    // =================================================
    // NEW TOTAL PRODUCTION
    // =================================================

    const newCompleted =
      existingCompleted + productionQuantity;


    // =================================================
    // PREVENT OVER-PRODUCTION
    // =================================================

    if (newCompleted > plannedQuantity) {
      return res.status(400).json({
        success: false,
        message: "Production quantity exceeds planned quantity",
        planned_quantity: plannedQuantity,
        existing_completed: existingCompleted,
        requested_quantity: productionQuantity,
        remaining_quantity:
          Math.max(
            plannedQuantity - existingCompleted,
            0
          )
      });
    }


    // =================================================
    // CREATE DAILY PRODUCTION
    // =================================================

    const { data: production, error: productionError } =
      await supabase
        .from("daily_production")
        .insert({
          project_id: Number(project_id),
          activity_id: Number(activity_id),

          production_date:
            production_date ||
            new Date().toISOString().split("T")[0],

          today_quantity: productionQuantity,

          manpower:
            Number(manpower || 0),

          equipment:
            Number(equipment || 0),

          working_hours:
            Number(working_hours || 0),

          remarks:
            remarks || null
        })
        .select("*")
        .single();

    if (productionError) {
      return res.status(500).json({
        success: false,
        message:
          "Failed to create daily production",
        error: productionError.message
      });
    }


    // =================================================
    // FINAL COMPLETED QUANTITY
    // =================================================

    const completedQuantity =
      Number(newCompleted.toFixed(2));

    const remainingQuantity =
      Number(
        Math.max(
          plannedQuantity - completedQuantity,
          0
        ).toFixed(2)
      );

    const progressPercent =
      Number(
        Math.min(
          (completedQuantity / plannedQuantity) * 100,
          100
        ).toFixed(2)
      );


    // =================================================
    // DETERMINE ACTIVITY STATUS
    // =================================================

    let status = "in_progress";

    if (completedQuantity <= 0) {
      status = "planned";
    } else if (completedQuantity >= plannedQuantity) {
      status = "completed";
    }


    // =================================================
    // UPDATE ONLY REAL STORED COLUMNS
    //
    // progress_percent / remaining_quantity may be
    // generated database columns, so we DO NOT update
    // them here.
    // =================================================

    const { data: updatedActivity, error: updateError } =
      await supabase
        .from("work_activities")
        .update({
          completed_quantity: completedQuantity,
          status: status
        })
        .eq("id", activity_id)
        .eq("project_id", project_id)
        .select("*")
        .single();


    if (updateError) {
      console.error(
        "Work activity update error:",
        updateError
      );

      return res.status(500).json({
        success: false,
        message:
          "Daily production created but work activity update failed",
        error: updateError.message
      });
    }


    // =================================================
    // SUCCESS RESPONSE
    // =================================================

    return res.status(201).json({
      success: true,

      message:
        "Daily production created successfully",

      production: production,

      calculation: {
        planned_quantity: plannedQuantity,
        previous_completed: existingCompleted,
        today_quantity: productionQuantity,
        completed_quantity: completedQuantity,
        remaining_quantity: remainingQuantity,
        progress_percent: progressPercent
      },

      activity: {
        id: updatedActivity.id,
        project_id: updatedActivity.project_id,
        activity_code: updatedActivity.activity_code,
        activity_name: updatedActivity.activity_name,

        planned_quantity:
          updatedActivity.planned_quantity,

        completed_quantity:
          updatedActivity.completed_quantity,

        remaining_quantity:
          updatedActivity.remaining_quantity,

        progress_percent:
          updatedActivity.progress_percent,

        status:
          updatedActivity.status
      }
    });

  } catch (error) {
    console.error(
      "Daily production error:",
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
// EXPORT ROUTER
// =====================================================

module.exports = router;