import { Area } from "../models/areaModel.js";
import { sendError, successResponse } from "../utils/response.js";

// Create Area
export const createArea = async (req, res) => {
  try {
    const { name, description, city } = req.body;

    if (!name || !city) {
      return sendError(res, "name and city are required fields", 400);
    }

    // Check if an area with the same name already exists
    const existingArea = await Area.findOne({ name });
    if (existingArea) {
      return sendError(res, "Area with this name already exists", 400);
    }

    // Create the new area
    const area = await Area.create({
      name,
      description: description || "",
      city,
    });

    return successResponse(res, "Area created successfully", { area }, 201);
  } catch (error) {
    console.error("Create Area Error:", error);
    return sendError(res, "Failed to create area", 500);
  }
};

// Get All Areas
export const getAllAreas = async (req, res) => {
  try {
    const areas = await Area.find(); // Fetch all areas without pagination
    const totalAreas = await Area.countDocuments();

    return successResponse(
      res,
      "Areas fetched successfully",
      {
        areas,
        totalItems: totalAreas,
      },
      200
    );
  } catch (error) {
    console.error("Get All Areas Error:", error);
    return sendError(res, "Failed to fetch areas", 500);
  }
};



// Get All Active Areas
export const getAllActiveAreas = async (req, res) => {
  try {
    // Only fetch areas with status = "active"
    const filter = { status: "active" };

    const areas = await Area.find(filter);
    const totalAreas = await Area.countDocuments(filter); // count only active ones

    return successResponse(
      res,
      "Active areas fetched successfully",
      {
        areas,
        totalItems: totalAreas,
      },
      200
    );
  } catch (error) {
    console.error("Get All Active Areas Error:", error);
    return sendError(res, "Failed to fetch active areas", 500);
  }
};



// Get Single Area by ID
export const getAreaById = async (req, res) => {
  try {
    const { id } = req.params;
    const area = await Area.findById(id)

    if (!area) return sendError(res, "Area not found", 404);

    return successResponse(res, "Area fetched successfully", { area }, 200);
  } catch (error) {
    console.error("Get Area By ID Error:", error);
    return sendError(res, "Failed to fetch area", 500);
  }
};


// Update Area
export const updateArea = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {};

    // Dynamically add only fields present in req.body
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.city) updateData.city = req.body.city;

    if (Object.keys(updateData).length === 0) {
      return sendError(res, "At least one field must be provided for update", 400);
    }

    const area = await Area.findByIdAndUpdate(id, updateData, { new: true });

    if (!area) return sendError(res, "Area not found", 404);

    return successResponse(res, "Area updated successfully", { area }, 200);
  } catch (error) {
    console.error("Update Area Error:", error);
    return sendError(res, "Failed to update area", 500);
  }
};


// Delete Area
export const deleteArea = async (req, res) => {
  try {
    const { id } = req.params;

    const area = await Area.findByIdAndDelete(id);

    if (!area) return sendError(res, "Area not found", 404);

    return successResponse(res, "Area deleted successfully", {}, 200);
  } catch (error) {
    console.error("Delete Area Error:", error);
    return sendError(res, "Failed to delete area", 500);
  }
};


// Toggle Area Status (Active/Inactive)
export const toggleAreaStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // expected "active" or "inactive"

    if (!["active", "inactive"].includes(status)) {
      return sendError(res, "Invalid status. Must be 'active' or 'inactive'.", 400);
    }

    const area = await Area.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!area) return sendError(res, "Area not found", 404);

    return successResponse(res, `Area status updated to ${status}`, { area }, 200);
  } catch (error) {
    console.error("Toggle Area Status Error:", error);
    return sendError(res, "Failed to update area status", 500);
  }
};



const areaController = {
  createArea,
  updateArea,
  deleteArea,
  getAllAreas,
  getAllActiveAreas,
  getAreaById,
  toggleAreaStatus
};

export default areaController;