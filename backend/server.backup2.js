// =========================
// UPDATE PROJECT
// =========================
app.put("/api/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      project_code,
      name,
      client_name,
      location,
      contract_value,
      start_date,
      end_date,
      status,
    } = req.body;

    const updateData = {};

    if (project_code !== undefined) updateData.project_code = project_code;
    if (name !== undefined) updateData.name = name;
    if (client_name !== undefined) updateData.client_name = client_name;
    if (location !== undefined) updateData.location = location;
    if (contract_value !== undefined) updateData.contract_value = contract_value;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (end_date !== undefined) updateData.end_date = end_date;
    if (status !== undefined) updateData.status = status;

    const { data, error } = await supabase
      .from("projects")
      .update(updateData)
      .eq("id", id)
      .select("*");

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to update project",
        error: error.message,
      });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Project not found or update not allowed",
      });
    }

    res.json({
      success: true,
      message: "Project updated successfully",
      project: data[0],
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});