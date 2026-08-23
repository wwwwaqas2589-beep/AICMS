const express = require("express");

const router = express.Router();

const supabase = require("../config/supabase");


// =====================================================
// GET ALL RESOURCE PERFORMANCE
// =====================================================

router.get("/", async (req, res) => {

  try {

    const { data, error } = await supabase
      .from("resource_utilization")
      .select("*")
      .order("id", { ascending: true });


    if (error) {

      return res.status(500).json({

        success: false,
        message: "Failed to calculate resource performance",
        error: error.message

      });

    }


    const performance = (data || []).map((item) => {

      const plannedHours =
        Number(item.planned_hours || 0);

      const actualHours =
        Number(item.actual_hours || 0);

      const plannedQuantity =
        Number(item.planned_quantity || 0);

      const actualQuantity =
        Number(item.actual_quantity || 0);


      const hoursVariance =
        plannedHours - actualHours;


      const quantityVariance =
        actualQuantity - plannedQuantity;


      let efficiency = 0;

      if (plannedHours > 0) {

        efficiency =
          (plannedHours / actualHours) * 100;

      }


      return {

        id: item.id,

        company_id: item.company_id,

        project_id: item.project_id,

        activity_id: item.activity_id,

        resource_planning_id:
          item.resource_planning_id,

        resource_type:
          item.resource_type,

        resource_code:
          item.resource_code,

        resource_name:
          item.resource_name,

        utilization_date:
          item.utilization_date,

        planned_quantity:
          plannedQuantity,

        actual_quantity:
          actualQuantity,

        quantity_variance:
          quantityVariance,

        planned_hours:
          plannedHours,

        actual_hours:
          actualHours,

        hours_variance:
          hoursVariance,

        planned_rate:
          Number(item.planned_rate || 0),

        actual_rate:
          Number(item.actual_rate || 0),

        planned_cost:
          plannedHours *
          Number(item.planned_rate || 0),

        actual_cost:
          actualHours *
          Number(item.actual_rate || 0),

        cost_variance:
          (
            plannedHours *
            Number(item.planned_rate || 0)
          ) -
          (
            actualHours *
            Number(item.actual_rate || 0)
          ),

        productivity_actual:
          Number(item.productivity_actual || 0),

        productivity_variance:
          Number(item.productivity_variance || 0),

        efficiency:
          Number(efficiency.toFixed(3)),

        status:
          item.status,

        remarks:
          item.remarks,

        created_at:
          item.created_at

      };

    });


    return res.json({

      success: true,

      count: performance.length,

      resource_performance:
        performance

    });


  } catch (error) {

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
// GET RESOURCE PERFORMANCE BY ACTIVITY
// =====================================================

router.get("/activity/:activityId", async (req, res) => {

  try {

    const activityId =
      Number(req.params.activityId);


    if (!activityId) {

      return res.status(400).json({

        success: false,

        message:
          "Valid activity ID is required"

      });

    }


    const { data, error } = await supabase
      .from("resource_utilization")
      .select("*")
      .eq("activity_id", activityId)
      .order("id", { ascending: true });


    if (error) {

      return res.status(500).json({

        success: false,

        message:
          "Failed to calculate activity resource performance",

        error:
          error.message

      });

    }


    const performance =
      (data || []).map((item) => {

        const plannedHours =
          Number(item.planned_hours || 0);

        const actualHours =
          Number(item.actual_hours || 0);

        const plannedQuantity =
          Number(item.planned_quantity || 0);

        const actualQuantity =
          Number(item.actual_quantity || 0);

        const plannedRate =
          Number(item.planned_rate || 0);

        const actualRate =
          Number(item.actual_rate || 0);


        const hoursVariance =
          plannedHours - actualHours;


        const quantityVariance =
          actualQuantity - plannedQuantity;


        const plannedCost =
          plannedHours *
          plannedRate;


        const actualCost =
          actualHours *
          actualRate;


        const costVariance =
          plannedCost -
          actualCost;


        let efficiency = 0;

        if (actualHours > 0) {

          efficiency =
            (plannedHours /
              actualHours) *
            100;

        }


        return {

          id:
            item.id,

          activity_id:
            item.activity_id,

          resource_type:
            item.resource_type,

          resource_code:
            item.resource_code,

          resource_name:
            item.resource_name,

          utilization_date:
            item.utilization_date,

          planned_quantity:
            plannedQuantity,

          actual_quantity:
            actualQuantity,

          quantity_variance:
            quantityVariance,

          planned_hours:
            plannedHours,

          actual_hours:
            actualHours,

          hours_variance:
            hoursVariance,

          planned_rate:
            plannedRate,

          actual_rate:
            actualRate,

          planned_cost:
            Number(plannedCost.toFixed(2)),

          actual_cost:
            Number(actualCost.toFixed(2)),

          cost_variance:
            Number(costVariance.toFixed(2)),

          productivity_actual:
            Number(
              item.productivity_actual || 0
            ),

          productivity_variance:
            Number(
              item.productivity_variance || 0
            ),

          efficiency:
            Number(
              efficiency.toFixed(3)
            ),

          status:
            item.status,

          remarks:
            item.remarks

        };

      });


    return res.json({

      success: true,

      activity_id:
        activityId,

      count:
        performance.length,

      resource_performance:
        performance

    });


  } catch (error) {

    return res.status(500).json({

      success: false,

      message:
        "Internal server error",

      error:
        error.message

    });

  }

});


module.exports = router;