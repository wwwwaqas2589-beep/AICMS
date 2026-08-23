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
      daily_costs: data
    });

  } catch (error) {
    console.error("Get daily costs error:", error);

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
    const {
      project_id,
      date
    } = req.params;

    const { data, error } = await supabase
      .from("daily_costs")
      .select("*")
      .eq("project_id", project_id)
      .eq("cost_date", date)
      .order("activity_id", {
        ascending: true
      });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch project daily costs",
        error: error.message
      });
    }

    const totalCost = data.reduce(
      (sum, item) =>
        sum + Number(item.total_cost || 0),
      0
    );

    return res.json({
      success: true,
      project_id: Number(project_id),
      cost_date: date,
      count: data.length,
      total_cost: Number(totalCost.toFixed(2)),
      daily_costs: data
    });

  } catch (error) {
    console.error("Get project daily costs error:", error);

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
      .order("cost_date", {
        ascending: false
      });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch activity cost",
        error: error.message
      });
    }

    const manpowerCost = data.reduce(
      (sum, item) =>
        sum + Number(item.manpower_cost || 0),
      0
    );

    const equipmentCost = data.reduce(
      (sum, item) =>
        sum + Number(item.equipment_cost || 0),
      0
    );

    const materialCost = data.reduce(
      (sum, item) =>
        sum + Number(item.material_cost || 0),
      0
    );

    const totalCost = data.reduce(
      (sum, item) =>
        sum + Number(item.total_cost || 0),
      0
    );

    return res.json({
      success: true,
      activity_id: Number(activity_id),
      count: data.length,

      summary: {
        manpower_cost: Number(manpowerCost.toFixed(2)),
        equipment_cost: Number(equipmentCost.toFixed(2)),
        material_cost: Number(materialCost.toFixed(2)),
        total_cost: Number(totalCost.toFixed(2))
      },

      daily_costs: data
    });

  } catch (error) {
    console.error("Get activity cost error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});


// =====================================================
// CREATE DAILY COST MANUALLY
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

    // =================================================
    // VALIDATION
    // =================================================

    if (!project_id || !cost_date) {
      return res.status(400).json({
        success: false,
        message: "project_id and cost_date are required"
      });
    }

    const manpowerCost = Number(manpower_cost || 0);
    const equipmentCost = Number(equipment_cost || 0);
    const materialCost = Number(material_cost || 0);

    if (
      !Number.isFinite(manpowerCost) ||
      !Number.isFinite(equipmentCost) ||
      !Number.isFinite(materialCost)
    ) {
      return res.status(400).json({
        success: false,
        message: "Cost values must be valid numbers"
      });
    }

    if (
      manpowerCost < 0 ||
      equipmentCost < 0 ||
      materialCost < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Cost values cannot be negative"
      });
    }

    // =================================================
    // OPTIONAL ACTIVITY VALIDATION
    // =================================================

    if (activity_id !== undefined && activity_id !== null) {
      const { data: activity, error: activityError } =
        await supabase
          .from("work_activities")
          .select("id, project_id")
          .eq("id", activity_id)
          .maybeSingle();

      if (activityError) {
        return res.status(500).json({
          success: false,
          message: "Failed to validate activity",
          error: activityError.message
        });
      }

      if (!activity) {
        return res.status(404).json({
          success: false,
          message: "Work activity not found"
        });
      }

      if (Number(activity.project_id) !== Number(project_id)) {
        return res.status(400).json({
          success: false,
          message:
            "Activity does not belong to the selected project"
        });
      }
    }

    // =================================================
    // CHECK EXISTING COST
    // =================================================

    let existingQuery = supabase
      .from("daily_costs")
      .select("id")
      .eq("project_id", project_id)
      .eq("cost_date", cost_date);

    if (activity_id !== undefined && activity_id !== null) {
      existingQuery = existingQuery.eq(
        "activity_id",
        activity_id
      );
    } else {
      existingQuery = existingQuery.is(
        "activity_id",
        null
      );
    }

    const {
      data: existingCost,
      error: existingError
    } = await existingQuery.maybeSingle();

    if (existingError) {
      return res.status(500).json({
        success: false,
        message: "Failed to check existing daily cost",
        error: existingError.message
      });
    }

    // =================================================
    // UPDATE EXISTING RECORD
    // =================================================

    if (existingCost) {
      const { data, error } = await supabase
        .from("daily_costs")
        .update({
          manpower_cost: Number(
            manpowerCost.toFixed(2)
          ),
          equipment_cost: Number(
            equipmentCost.toFixed(2)
          ),
          material_cost: Number(
            materialCost.toFixed(2)
          ),
          remarks: remarks || null
        })
        .eq("id", existingCost.id)
        .select("*")
        .single();

      if (error) {
        return res.status(500).json({
          success: false,
          message: "Failed to update daily cost",
          error: error.message
        });
      }

      return res.json({
        success: true,
        message: "Daily cost updated successfully",
        daily_cost: data
      });
    }

    // =================================================
    // CREATE NEW RECORD
    // =================================================

    const insertData = {
      project_id: Number(project_id),
      activity_id:
        activity_id !== undefined &&
        activity_id !== null
          ? Number(activity_id)
          : null,

      cost_date,

      manpower_cost: Number(
        manpowerCost.toFixed(2)
      ),

      equipment_cost: Number(
        equipmentCost.toFixed(2)
      ),

      material_cost: Number(
        materialCost.toFixed(2)
      ),

      remarks: remarks || null
    };

    const { data, error } = await supabase
      .from("daily_costs")
      .insert(insertData)
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
      daily_cost: data
    });

  } catch (error) {
    console.error(
      "Create daily cost error:",
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
// CALCULATE + SAVE DAILY COST
//
// GET
// /api/daily-costs/calculate/:project_id/:activity_id/:date
// =====================================================

router.get(
  "/calculate/:project_id/:activity_id/:date",
  async (req, res) => {

    try {

      const {
        project_id,
        activity_id,
        date
      } = req.params;


      // =================================================
      // MANPOWER
      // =================================================

      const {
        data: manpower,
        error: manpowerError
      } = await supabase
        .from("manpower_records")
        .select("*")
        .eq("project_id", project_id)
        .eq("activity_id", activity_id)
        .eq("work_date", date);

      if (manpowerError) {
        return res.status(500).json({
          success: false,
          message: "Failed to fetch manpower cost",
          error: manpowerError.message
        });
      }


      // =================================================
      // EQUIPMENT
      // =================================================

      const {
        data: equipment,
        error: equipmentError
      } = await supabase
        .from("equipment_records")
        .select("*")
        .eq("project_id", project_id)
        .eq("activity_id", activity_id)
        .eq("work_date", date);

      if (equipmentError) {
        return res.status(500).json({
          success: false,
          message: "Failed to fetch equipment cost",
          error: equipmentError.message
        });
      }


      // =================================================
      // MATERIAL
      // =================================================

      const {
        data: materials,
        error: materialError
      } = await supabase
        .from("material_transactions")
        .select("*")
        .eq("project_id", project_id)
        .eq("activity_id", activity_id)
        .eq("transaction_date", date);

      if (materialError) {
        return res.status(500).json({
          success: false,
          message: "Failed to fetch material cost",
          error: materialError.message
        });
      }


      // =================================================
      // MANPOWER COST
      // =================================================

      let manpowerCost = 0;

      manpower.forEach((item) => {
        manpowerCost += Number(
          item.total_cost ||
          item.totalCost ||
          0
        );
      });


      // =================================================
      // EQUIPMENT COST
      // =================================================

      let equipmentCost = 0;

      equipment.forEach((item) => {
        equipmentCost += Number(
          item.total_cost ||
          item.totalCost ||
          0
        );
      });


      // =================================================
      // MATERIAL COST
      // =================================================

      let materialCost = 0;

      materials.forEach((item) => {
        materialCost += Number(
          item.total_cost || 0
        );
      });


      // =================================================
      // TOTAL ACTUAL COST
      // =================================================

      const totalActualCost =
        manpowerCost +
        equipmentCost +
        materialCost;


      // =================================================
      // GET WORK ACTIVITY
      // =================================================

      const {
        data: activity,
        error: activityError
      } = await supabase
        .from("work_activities")
        .select("*")
        .eq("id", activity_id)
        .eq("project_id", project_id)
        .maybeSingle();

      if (activityError) {
        return res.status(500).json({
          success: false,
          message: "Failed to fetch activity",
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
      // QUANTITY
      // =================================================

      const plannedQuantity =
        Number(
          activity.planned_quantity || 0
        );

      const completedQuantity =
        Number(
          activity.completed_quantity || 0
        );

      const remainingQuantity =
        Math.max(
          plannedQuantity -
          completedQuantity,
          0
        );


      // =================================================
      // PROGRESS %
      // =================================================

      let progressPercent = 0;

      if (plannedQuantity > 0) {
        progressPercent =
          (
            completedQuantity /
            plannedQuantity
          ) * 100;
      }

      progressPercent =
        Math.min(
          progressPercent,
          100
        );


      // =================================================
      // COST PER UNIT
      // =================================================

      let costPerUnit = 0;

      if (completedQuantity > 0) {
        costPerUnit =
          totalActualCost /
          completedQuantity;
      }


      // =================================================
      // CHECK EXISTING DAILY COST
      // =================================================

      const {
        data: existingCost,
        error: existingError
      } = await supabase
        .from("daily_costs")
        .select("id")
        .eq("project_id", project_id)
        .eq("activity_id", activity_id)
        .eq("cost_date", date)
        .maybeSingle();

      if (existingError) {
        return res.status(500).json({
          success: false,
          message:
            "Failed to check existing daily cost",
          error: existingError.message
        });
      }


      // =================================================
      // SAVE DATA
      // IMPORTANT:
      // total_cost IS NOT SENT.
      // Database calculates total_cost.
      // =================================================

      let savedCost = null;


      if (existingCost) {

        const {
          data,
          error
        } = await supabase
          .from("daily_costs")
          .update({

            manpower_cost:
              Number(
                manpowerCost.toFixed(2)
              ),

            equipment_cost:
              Number(
                equipmentCost.toFixed(2)
              ),

            material_cost:
              Number(
                materialCost.toFixed(2)
              ),

            remarks:
              "Automatically calculated from manpower, equipment and materials."

          })
          .eq(
            "id",
            existingCost.id
          )
          .select("*")
          .single();


        if (error) {
          return res.status(500).json({
            success: false,
            message:
              "Failed to update daily cost",
            error: error.message
          });
        }

        savedCost = data;

      } else {

        const {
          data,
          error
        } = await supabase
          .from("daily_costs")
          .insert({

            project_id:
              Number(project_id),

            activity_id:
              Number(activity_id),

            cost_date:
              date,

            manpower_cost:
              Number(
                manpowerCost.toFixed(2)
              ),

            equipment_cost:
              Number(
                equipmentCost.toFixed(2)
              ),

            material_cost:
              Number(
                materialCost.toFixed(2)
              ),

            remarks:
              "Automatically calculated from manpower, equipment and materials."

          })
          .select("*")
          .single();


        if (error) {
          return res.status(500).json({
            success: false,
            message:
              "Failed to save daily cost",
            error: error.message
          });
        }

        savedCost = data;

      }


      // =================================================
      // RESPONSE
      // =================================================

      return res.json({

        success: true,

        message:
          "Daily cost calculated and saved successfully.",

        project_id:
          Number(project_id),

        activity_id:
          Number(activity_id),

        cost_date:
          date,


        // =================================================
        // ACTIVITY
        // =================================================

        activity: {

          activity_code:
            activity.activity_code,

          activity_name:
            activity.activity_name,

          unit:
            activity.unit,

          planned_quantity:
            Number(
              plannedQuantity.toFixed(2)
            ),

          completed_quantity:
            Number(
              completedQuantity.toFixed(2)
            ),

          remaining_quantity:
            Number(
              remainingQuantity.toFixed(2)
            ),

          progress_percent:
            Number(
              progressPercent.toFixed(2)
            )

        },


        // =================================================
        // COST
        // =================================================

        cost: {

          manpower_cost:
            Number(
              manpowerCost.toFixed(2)
            ),

          equipment_cost:
            Number(
              equipmentCost.toFixed(2)
            ),

          material_cost:
            Number(
              materialCost.toFixed(2)
            ),

          total_actual_cost:
            Number(
              totalActualCost.toFixed(2)
            ),

          cost_per_unit:
            Number(
              costPerUnit.toFixed(2)
            )

        },


        // =================================================
        // DATABASE RECORD
        // =================================================

        saved_daily_cost:
          savedCost

      });


    } catch (error) {

      console.error(
        "Daily cost calculation error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message
      });

    }

  }
);


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
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete daily cost",
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Daily cost not found"
      });
    }

    return res.json({
      success: true,
      message: "Daily cost deleted successfully",
      daily_cost: data
    });

  } catch (error) {
    console.error(
      "Delete daily cost error:",
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
// EXPORT
// =====================================================

module.exports = router;