const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// GET ALL INSPECTION REQUESTS
// GET /api/inspection-requests
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("inspection_requests")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch inspection requests",
        error: error.message
      });
    }

    return res.json({
      success: true,
      count: data.length,
      inspection_requests: data
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
// GET INSPECTION REQUEST BY ID
// GET /api/inspection-requests/:id
// =====================================================

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("inspection_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch inspection request",
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Inspection request not found"
      });
    }

    return res.json({
      success: true,
      inspection_request: data
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
// GET BY PROJECT
// GET /api/inspection-requests/project/:project_id
// =====================================================

router.get("/project/:project_id", async (req, res) => {
  try {
    const { project_id } = req.params;

    const { data, error } = await supabase
      .from("inspection_requests")
      .select("*")
      .eq("project_id", project_id)
      .order("id", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch project inspection requests",
        error: error.message
      });
    }

    return res.json({
      success: true,
      project_id: Number(project_id),
      count: data.length,
      inspection_requests: data
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
// GET BY ACTIVITY
// GET /api/inspection-requests/activity/:activity_id
// =====================================================

router.get("/activity/:activity_id", async (req, res) => {
  try {
    const { activity_id } = req.params;

    const { data, error } = await supabase
      .from("inspection_requests")
      .select("*")
      .eq("activity_id", activity_id)
      .order("id", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch activity inspection requests",
        error: error.message
      });
    }

    return res.json({
      success: true,
      activity_id: Number(activity_id),
      count: data.length,
      inspection_requests: data
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
// CREATE INSPECTION REQUEST
// POST /api/inspection-requests
// =====================================================

router.post("/", async (req, res) => {
  try {
    const {
      company_id,
      project_id,
      user_id,
      ir_number,
      request_date,
      inspection_date,
      inspection_type,
      activity_id,
      activity_name,
      location,
      description,
      inspector_name,
      remarks
    } = req.body;

    if (!project_id) {
      return res.status(400).json({
        success: false,
        message: "project_id is required"
      });
    }

    if (!activity_id) {
      return res.status(400).json({
        success: false,
        message: "activity_id is required"
      });
    }

    if (!ir_number) {
      return res.status(400).json({
        success: false,
        message: "ir_number is required"
      });
    }

    const { data, error } = await supabase
      .from("inspection_requests")
      .insert([
        {
          company_id: company_id || null,
          project_id: Number(project_id),
          user_id: user_id || null,
          ir_number,
          request_date: request_date || new Date().toISOString().split("T")[0],
          inspection_date: inspection_date || null,
          inspection_type: inspection_type || null,
          activity_id: Number(activity_id),
          activity_name: activity_name || null,
          location: location || null,
          description: description || null,
          inspector_name: inspector_name || null,
          status: "PENDING",
          remarks: remarks || null
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to create inspection request",
        error: error.message
      });
    }

    return res.status(201).json({
      success: true,
      message: "Inspection request created successfully",
      inspection_request: data
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
// APPROVE INSPECTION REQUEST
// PATCH /api/inspection-requests/:id/approve
// =====================================================

router.patch("/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { inspector_name, remarks } = req.body;

    const { data, error } = await supabase
      .from("inspection_requests")
      .update({
        status: "APPROVED",
        inspector_name: inspector_name || null,
        remarks: remarks || null
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to approve inspection request",
        error: error.message
      });
    }

    return res.json({
      success: true,
      message: "Inspection request approved successfully",
      inspection_request: data
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
// REJECT INSPECTION REQUEST
// PATCH /api/inspection-requests/:id/reject
// =====================================================

router.patch("/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    if (!remarks) {
      return res.status(400).json({
        success: false,
        message: "Rejection remarks are required"
      });
    }

    const { data, error } = await supabase
      .from("inspection_requests")
      .update({
        status: "REJECTED",
        remarks
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to reject inspection request",
        error: error.message
      });
    }

    return res.json({
      success: true,
      message: "Inspection request rejected",
      inspection_request: data
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