const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");


// =====================================================
// GET PROJECT PLANNING CONTROL
// GET /api/planning-control/project/:projectId
// =====================================================

router.get("/project/:projectId", async (req, res) => {
  try {

    const projectId = Number(req.params.projectId);

    const statusDate =
      req.query.date ||
      new Date().toISOString().split("T")[0];


    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Valid project ID is required"
      });
    }


    // =================================================
    // PLANNING
    // =================================================

    const {
      data: planning,
      error: planningError
    } = await supabase
      .from("project_planning")
      .select("*")
      .eq("project_id", projectId)
      .order("id", {
        ascending: true
      });


    if (planningError) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch planning",
        error: planningError.message
      });
    }


    // =================================================
    // DAILY PRODUCTION
    // =================================================

    const {
      data: production,
      error: productionError
    } = await supabase
      .from("daily_production")
      .select("*")
      .eq("project_id", projectId);


    if (productionError) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch production",
        error: productionError.message
      });
    }


    // =================================================
    // DAILY COSTS
    // =================================================

    const {
      data: dailyCosts,
      error: costError
    } = await supabase
      .from("daily_costs")
      .select("*")
      .eq("project_id", projectId);


    if (costError) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch daily costs",
        error: costError.message
      });
    }


    // =================================================
    // HELPER FUNCTIONS
    // =================================================

    const round2 = (value) =>
      Number(Number(value || 0).toFixed(2));


    const round3 = (value) =>
      Number(Number(value || 0).toFixed(3));


    // =================================================
    // CALCULATE TIME-PHASED PLANNED PROGRESS
    // =================================================

    const calculatePlannedProgress = (item) => {

      const start =
        item.baseline_start_date ||
        item.start_date;

      const finish =
        item.baseline_finish_date ||
        item.finish_date;


      if (!start || !finish) {

        return Number(
          item.planned_progress || 0
        );

      }


      const startDate =
        new Date(start + "T00:00:00");

      const finishDate =
        new Date(finish + "T00:00:00");

      const currentDate =
        new Date(statusDate + "T00:00:00");


      if (
        isNaN(startDate.getTime()) ||
        isNaN(finishDate.getTime())
      ) {

        return Number(
          item.planned_progress || 0
        );

      }


      // Before activity starts
      if (currentDate < startDate) {
        return 0;
      }


      // On or after finish date
      if (currentDate >= finishDate) {
        return 100;
      }


      const totalDuration =
        finishDate.getTime() -
        startDate.getTime();


      const elapsedDuration =
        currentDate.getTime() -
        startDate.getTime();


      if (totalDuration <= 0) {
        return 0;
      }


      const progress =
        (elapsedDuration /
          totalDuration) *
        100;


      return Math.max(
        0,
        Math.min(
          100,
          progress
        )
      );

    };


    // =================================================
    // CALCULATE ACTUAL PRODUCTION FOR ACTIVITY
    // =================================================

    const getActivityProduction = (activityId) => {

      return (production || [])
        .filter(
          item =>
            Number(item.activity_id) ===
            Number(activityId)
        )
        .reduce(
          (sum, item) =>
            sum +
            Number(
              item.today_quantity || 0
            ),
          0
        );

    };


    // =================================================
    // PROJECT TOTAL BUDGET
    // =================================================

    const totalBudget =
      (planning || []).reduce(
        (sum, item) =>
          sum +
          Number(
            item.budget_cost || 0
          ),
        0
      );


    // =================================================
    // PROJECT TOTAL ACTUAL COST
    // =================================================

    const totalActualCost =
      (dailyCosts || []).reduce(
        (sum, item) =>
          sum +
          Number(
            item.total_cost || 0
          ),
        0
      );


    // =================================================
    // ACTIVITY CONTROL
    // =================================================

    const activities =
      (planning || []).map(item => {

        const budget =
          Number(
            item.budget_cost || 0
          );


        // =============================================
        // PLANNED PROGRESS
        // =============================================

        const planned =
          calculatePlannedProgress(
            item
          );


        // =============================================
        // ACTUAL PRODUCTION
        // =============================================

        const actualProduction =
          getActivityProduction(
            item.activity_id
          );


        // =============================================
        // PLANNED QUANTITY
        // =============================================

        const plannedQuantity =
          Number(
            item.planned_quantity ||
            item.budget_quantity ||
            0
          );


        // =============================================
        // ACTUAL PROGRESS
        // Production-based
        // =============================================

        let actual = 0;


        if (plannedQuantity > 0) {

          actual =
            (
              actualProduction /
              plannedQuantity
            ) *
            100;

        }


        actual =
          Math.max(
            0,
            Math.min(
              100,
              actual
            )
          );


        // =============================================
        // EVM
        // =============================================

        const activityPV =
          budget *
          (planned / 100);


        const activityEV =
          budget *
          (actual / 100);


        // =============================================
        // ACTUAL COST
        // =============================================

        const activityCosts =
          (dailyCosts || [])
            .filter(
              cost =>
                Number(
                  cost.activity_id
                ) ===
                Number(
                  item.activity_id
                )
            );


        const activityAC =
          activityCosts.reduce(
            (sum, cost) =>
              sum +
              Number(
                cost.total_cost || 0
              ),
            0
          );


        // =============================================
        // VARIANCE
        // =============================================

        const activityCV =
          activityEV -
          activityAC;


        const activitySV =
          activityEV -
          activityPV;


        // =============================================
        // PERFORMANCE INDEX
        // =============================================

        const activityCPI =
          activityAC > 0
            ? activityEV /
              activityAC
            : 0;


        const activitySPI =
          activityPV > 0
            ? activityEV /
              activityPV
            : null;


        // =============================================
        // SCHEDULE STATUS
        // =============================================

        let activityScheduleStatus =
          "NOT_STARTED";


        if (
          actual >= 100
        ) {

          activityScheduleStatus =
            "COMPLETED";

        }
        else if (
          planned > 0 &&
          actual === 0
        ) {

          activityScheduleStatus =
            "BEHIND";

        }
        else if (
          activitySPI !== null &&
          activitySPI < 0.90
        ) {

          activityScheduleStatus =
            "BEHIND";

        }
        else if (
          activitySPI !== null &&
          activitySPI > 1.10
        ) {

          activityScheduleStatus =
            "AHEAD";

        }
        else if (
          actual > 0
        ) {

          activityScheduleStatus =
            "ON_TRACK";

        }


        // =============================================
        // COST STATUS
        // =============================================

        let activityCostStatus =
          "ON_BUDGET";


        if (
          activityCPI > 0 &&
          activityCPI < 0.90
        ) {

          activityCostStatus =
            "OVER_BUDGET";

        }
        else if (
          activityCPI > 1.10
        ) {

          activityCostStatus =
            "UNDER_BUDGET";

        }


        // =============================================
        // REMAINING QUANTITY
        // =============================================

        const remainingQuantity =
          Math.max(
            0,
            plannedQuantity -
            actualProduction
          );


        // =============================================
        // RETURN ACTIVITY
        // =============================================

        return {

          activity_id:
            item.activity_id,

          activity_code:
            item.activity_code,

          activity_name:
            item.activity_name,

          wbs_code:
            item.wbs_code,

          wbs_name:
            item.wbs_name,

          unit:
            item.unit,

          planned_quantity:
            round2(
              plannedQuantity
            ),

          completed_quantity:
            round2(
              actualProduction
            ),

          remaining_quantity:
            round2(
              remainingQuantity
            ),

          budget_quantity:
            round2(
              item.budget_quantity
            ),

          budget_cost:
            round2(
              budget
            ),

          planned_progress:
            round2(
              planned
            ),

          actual_progress:
            round2(
              actual
            ),

          progress_variance:
            round2(
              actual - planned
            ),

          pv:
            round2(
              activityPV
            ),

          ev:
            round2(
              activityEV
            ),

          ac:
            round2(
              activityAC
            ),

          cv:
            round2(
              activityCV
            ),

          sv:
            round2(
              activitySV
            ),

          cpi:
            round3(
              activityCPI
            ),

          spi:
            activitySPI === null
              ? null
              : round3(
                  activitySPI
                ),

          schedule_status:
            activityScheduleStatus,

          cost_status:
            activityCostStatus,

          status:
            item.status

        };

      });


    // =================================================
    // PROJECT PLANNED PROGRESS
    // WEIGHTED BY BUDGET
    // =================================================

    const plannedProgress =
      totalBudget > 0
        ? activities.reduce(
            (sum, item) =>
              sum +
              (
                item.planned_progress *
                item.budget_cost
              ),
            0
          ) /
          totalBudget
        : 0;


    // =================================================
    // PROJECT ACTUAL PROGRESS
    // WEIGHTED BY BUDGET
    // =================================================

    const actualProgress =
      totalBudget > 0
        ? activities.reduce(
            (sum, item) =>
              sum +
              (
                item.actual_progress *
                item.budget_cost
              ),
            0
          ) /
          totalBudget
        : 0;


    // =================================================
    // PROGRESS VARIANCE
    // =================================================

    const progressVariance =
      actualProgress -
      plannedProgress;


    // =================================================
    // PROJECT EVM
    // =================================================

    const bac =
      totalBudget;


    const pv =
      bac *
      (
        plannedProgress /
        100
      );


    const ev =
      bac *
      (
        actualProgress /
        100
      );


    const ac =
      totalActualCost;


    const cv =
      ev -
      ac;


    const sv =
      ev -
      pv;


    const cpi =
      ac > 0
        ? ev / ac
        : 0;


    const spi =
      pv > 0
        ? ev / pv
        : null;


    // =================================================
    // FORECAST
    // =================================================

    const eac =
      cpi > 0
        ? bac / cpi
        : bac;


    const etc =
      Math.max(
        0,
        eac - ac
      );


    const vac =
      bac - eac;


    // =================================================
    // PROJECT SCHEDULE STATUS
    // =================================================

    let scheduleStatus =
      "ON_TRACK";


    if (actualProgress >= 100) {

      scheduleStatus =
        "COMPLETED";

    }
    else if (
      spi === null
    ) {

      scheduleStatus =
        plannedProgress > 0
          ? "BEHIND"
          : "NOT_STARTED";

    }
    else if (
      plannedProgress > 0 &&
      actualProgress === 0
    ) {

      scheduleStatus =
        "BEHIND";

    }
    else if (
      spi < 0.90
    ) {

      scheduleStatus =
        "BEHIND";

    }
    else if (
      spi > 1.10
    ) {

      scheduleStatus =
        "AHEAD";

    }


    // =================================================
    // PROJECT COST STATUS
    // =================================================

    let costStatus =
      "ON_BUDGET";


    if (
      cpi > 0 &&
      cpi < 0.90
    ) {

      costStatus =
        "OVER_BUDGET";

    }
    else if (
      cpi > 1.10
    ) {

      costStatus =
        "UNDER_BUDGET";

    }


    // =================================================
    // RESPONSE
    // =================================================

    return res.json({

      success: true,

      project_id:
        projectId,

      status_date:
        statusDate,


      control_summary: {

        total_activities:
          planning.length,

        total_budget:
          round2(
            totalBudget
          ),

        total_actual_cost:
          round2(
            totalActualCost
          ),

        planned_progress:
          round2(
            plannedProgress
          ),

        actual_progress:
          round2(
            actualProgress
          ),

        progress_variance:
          round2(
            progressVariance
          ),

        schedule_status:
          scheduleStatus,

        cost_status:
          costStatus

      },


      evm: {

        bac:
          round2(
            bac
          ),

        pv:
          round2(
            pv
          ),

        ev:
          round2(
            ev
          ),

        ac:
          round2(
            ac
          ),

        cv:
          round2(
            cv
          ),

        sv:
          round2(
            sv
          ),

        cpi:
          round3(
            cpi
          ),

        spi:
          spi === null
            ? null
            : round3(
                spi
              ),

        eac:
          round2(
            eac
          ),

        etc:
          round2(
            etc
          ),

        vac:
          round2(
            vac
          )

      },


      activities:
        activities,


      production_count:
        (production || []).length,

      cost_count:
        (dailyCosts || []).length

    });


  }
  catch (error) {

    console.error(
      "Planning control error:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        "Server error",

      error:
        error.message

    });

  }

});


// =====================================================
// EXPORT
// =====================================================

module.exports = router;





