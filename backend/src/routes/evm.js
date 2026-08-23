const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");


// =====================================================
// DATE HELPERS
// =====================================================

function calculatePlannedProgress(
  startDate,
  finishDate,
  statusDate
) {

  if (!startDate || !finishDate) {
    return 0;
  }

  const start = new Date(startDate);
  const finish = new Date(finishDate);
  const status = new Date(statusDate);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(finish.getTime()) ||
    Number.isNaN(status.getTime())
  ) {
    return 0;
  }

  if (status <= start) {
    return 0;
  }

  if (status >= finish) {
    return 100;
  }

  const totalDuration =
    finish.getTime() - start.getTime();

  const elapsedDuration =
    status.getTime() - start.getTime();

  if (totalDuration <= 0) {
    return 0;
  }

  const progress =
    (elapsedDuration / totalDuration) * 100;

  return Math.max(
    0,
    Math.min(100, progress)
  );
}


// =====================================================
// EVM CALCULATION
// =====================================================

async function calculateEVM(
  projectId,
  activityId = null,
  statusDate = null
) {

  const calculationDate =
    statusDate ||
    new Date().toISOString().split("T")[0];


  // ===================================================
  // PLANNING DATA
  // ===================================================

  let planningQuery = supabase
    .from("project_planning")
    .select("*")
    .eq("project_id", projectId);

  if (activityId !== null) {
    planningQuery =
      planningQuery.eq(
        "activity_id",
        activityId
      );
  }

  const {
    data: planning,
    error: planningError
  } = await planningQuery;


  if (planningError) {
    throw new Error(
      "Failed to fetch planning data: " +
      planningError.message
    );
  }


  if (!planning || planning.length === 0) {

    return {
      project_id: projectId,
      activity_id: activityId,
      status_date: calculationDate,
      bac: 0,
      pv: 0,
      ev: 0,
      ac: 0,
      cv: 0,
      sv: 0,
      cpi: 0,
      spi: 0,
      eac: 0,
      etc: 0,
      vac: 0,
      planned_progress: 0,
      actual_progress: 0
    };

  }


  // ===================================================
  // BAC
  // ===================================================

  const bac =
    planning.reduce(
      (sum, item) =>
        sum + Number(
          item.budget_cost || 0
        ),
      0
    );


  // ===================================================
  // PLANNED PROGRESS
  // ===================================================

  let plannedProgressTotal = 0;


  planning.forEach(item => {

    let plannedProgress =
      Number(
        item.planned_progress || 0
      );


    // If planned_progress is 0,
    // calculate it from baseline dates.

    if (
      plannedProgress === 0 &&
      item.baseline_start_date &&
      item.baseline_finish_date
    ) {

      plannedProgress =
        calculatePlannedProgress(
          item.baseline_start_date,
          item.baseline_finish_date,
          calculationDate
        );

    }

    plannedProgressTotal +=
      plannedProgress;

  });


  const plannedProgress =
    plannedProgressTotal /
    planning.length;


  // ===================================================
  // ACTUAL PROGRESS
  // ===================================================

  const actualProgress =
    planning.reduce(
      (sum, item) =>
        sum +
        Number(
          item.actual_progress || 0
        ),
      0
    ) / planning.length;


  // ===================================================
  // PV - PLANNED VALUE
  // ===================================================

  const pv =
    bac *
    (plannedProgress / 100);


  // ===================================================
  // EV - EARNED VALUE
  // ===================================================

  const ev =
    bac *
    (actualProgress / 100);


  // ===================================================
  // ACTUAL COST
  // ===================================================

  let costQuery = supabase
    .from("daily_costs")
    .select("total_cost")
    .eq("project_id", projectId);

  if (activityId !== null) {

    costQuery =
      costQuery.eq(
        "activity_id",
        activityId
      );

  }


  const {
    data: costs,
    error: costError
  } = await costQuery;


  if (costError) {

    throw new Error(
      "Failed to fetch actual costs: " +
      costError.message
    );

  }


  const ac =
    (costs || []).reduce(
      (sum, item) =>
        sum +
        Number(
          item.total_cost || 0
        ),
      0
    );


  // ===================================================
  // CV
  // ===================================================

  const cv =
    ev - ac;


  // ===================================================
  // SV
  // ===================================================

  const sv =
    ev - pv;


  // ===================================================
  // CPI
  // ===================================================

  const cpi =
    ac > 0
      ? ev / ac
      : 0;


  // ===================================================
  // SPI
  // ===================================================

  const spi =
    pv > 0
      ? ev / pv
      : 0;


  // ===================================================
  // EAC
  // ===================================================

  const eac =
    cpi > 0
      ? bac / cpi
      : bac;


  // ===================================================
  // ETC
  // ===================================================

  const etc =
    Math.max(
      0,
      eac - ac
    );


  // ===================================================
  // VAC
  // ===================================================

  const vac =
    bac - eac;


  // ===================================================
  // RESULT
  // ===================================================

  return {

    project_id:
      projectId,

    activity_id:
      activityId,

    status_date:
      calculationDate,

    bac:
      Number(bac.toFixed(2)),

    pv:
      Number(pv.toFixed(2)),

    ev:
      Number(ev.toFixed(2)),

    ac:
      Number(ac.toFixed(2)),

    cv:
      Number(cv.toFixed(2)),

    sv:
      Number(sv.toFixed(2)),

    cpi:
      Number(cpi.toFixed(3)),

    spi:
      Number(spi.toFixed(3)),

    eac:
      Number(eac.toFixed(2)),

    etc:
      Number(etc.toFixed(2)),

    vac:
      Number(vac.toFixed(2)),

    planned_progress:
      Number(
        plannedProgress.toFixed(2)
      ),

    actual_progress:
      Number(
        actualProgress.toFixed(2)
      )

  };

}


// =====================================================
// PROJECT EVM
// =====================================================

router.get(
  "/project/:projectId",
  async (req, res) => {

    try {

      const projectId =
        Number(req.params.projectId);

      const statusDate =
        req.query.date || null;


      if (!projectId) {

        return res.status(400).json({
          success: false,
          message:
            "Valid project ID is required"
        });

      }


      const evm =
        await calculateEVM(
          projectId,
          null,
          statusDate
        );


      return res.json({

        success: true,

        message:
          "Project EVM calculated successfully",

        evm

      });

    } catch (error) {

      return res.status(500).json({

        success: false,

        message:
          "Failed to calculate project EVM",

        error:
          error.message

      });

    }

  }
);


// =====================================================
// ACTIVITY EVM
// =====================================================

router.get(
  "/activity/:activityId",
  async (req, res) => {

    try {

      const activityId =
        Number(req.params.activityId);

      const statusDate =
        req.query.date || null;


      if (!activityId) {

        return res.status(400).json({
          success: false,
          message:
            "Valid activity ID is required"
        });

      }


      const {
        data: activity,
        error
      } = await supabase
        .from("project_planning")
        .select("project_id")
        .eq(
          "activity_id",
          activityId
        )
        .limit(1)
        .single();


      if (error || !activity) {

        return res.status(404).json({

          success: false,

          message:
            "Activity planning record not found"

        });

      }


      const evm =
        await calculateEVM(
          activity.project_id,
          activityId,
          statusDate
        );


      return res.json({

        success: true,

        message:
          "Activity EVM calculated successfully",

        evm

      });

    } catch (error) {

      return res.status(500).json({

        success: false,

        message:
          "Failed to calculate activity EVM",

        error:
          error.message

      });

    }

  }
);


// =====================================================
// PROJECT ACTIVITY EVM
// =====================================================

router.get(
  "/project/:projectId/activities",
  async (req, res) => {

    try {

      const projectId =
        Number(req.params.projectId);

      const statusDate =
        req.query.date || null;


      const {
        data: planning,
        error
      } = await supabase
        .from("project_planning")
        .select("*")
        .eq(
          "project_id",
          projectId
        )
        .order("id", {
          ascending: true
        });


      if (error) {

        return res.status(500).json({

          success: false,

          message:
            "Failed to fetch project activities",

          error:
            error.message

        });

      }


      const results = [];


      for (
        const item of planning || []
      ) {

        const evm =
          await calculateEVM(
            projectId,
            item.activity_id,
            statusDate
          );


        results.push({

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

          ...evm

        });

      }


      return res.json({

        success: true,

        project_id:
          projectId,

        count:
          results.length,

        activities:
          results

      });

    } catch (error) {

      return res.status(500).json({

        success: false,

        message:
          "Failed to calculate activity EVM",

        error:
          error.message

      });

    }

  }
);


module.exports = router;