const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// GET ALL PROJECTS
// GET /api/projects
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch projects",
        error: error.message
      });
    }

    return res.json({
      success: true,
      count: data.length,
      projects: data
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
// GET PROJECT BY ID
// GET /api/projects/:id
// =====================================================

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch project",
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Project not found"
      });
    }

    return res.json({
      success: true,
      project: data
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
// UPDATE PROJECT
// PUT /api/projects/:id
// =====================================================

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    console.log("Updating project ID:", id);
    console.log("Update body:", req.body);

    const updateData = {};

    if (req.body.name !== undefined) {
      updateData.name = req.body.name;
    }

    if (req.body.location !== undefined) {
      updateData.location = req.body.location;
    }

    if (req.body.contract_value !== undefined) {
      updateData.contract_value = req.body.contract_value;
    }

    if (req.body.start_date !== undefined) {
      updateData.start_date = req.body.start_date;
    }

    if (req.body.end_date !== undefined) {
      updateData.end_date = req.body.end_date;
    }

    if (req.body.status !== undefined) {
      updateData.status = req.body.status;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields provided for update"
      });
    }

    const { error: updateError } = await supabase
      .from("projects")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      console.error("Supabase update error:", updateError);

      return res.status(500).json({
        success: false,
        message: "Failed to update project",
        error: updateError.message
      });
    }

    const { data, error: fetchError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      return res.status(500).json({
        success: false,
        message: "Project updated but failed to fetch updated data",
        error: fetchError.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Project not found after update"
      });
    }

    return res.json({
      success: true,
      message: "Project updated successfully",
      project: data
    });

  } catch (error) {
    console.error("Update project error:", error);

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
// =====================================================
// CREATE PROJECT
// POST /api/projects
// =====================================================

router.post("/", async (req, res) => {
  try {
    const {
      company_id,
      project_code,
      name,
      client_name,
      location,
      contract_value,
      start_date,
      end_date,
      status
    } = req.body;

    if (!company_id || !project_code || !name) {
      return res.status(400).json({
        success: false,
        message: "company_id, project_code and name are required"
      });
    }

    const { data, error } = await supabase
      .from("projects")
      .insert([
        {
          company_id,
          project_code,
          name,
          client_name,
          location,
          contract_value,
          start_date,
          end_date,
          status: status || "active"
        }
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase create error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to create project",
        error: error.message
      });
    }

    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      project: data
    });

  } catch (error) {
    console.error("Create project error:", error);

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
