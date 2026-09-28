import Generic from "../models/genericModel.js";
import { sendError, successResponse } from "../utils/response.js";

// Get paginated generics
export const getAllGenerics = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const search = req.query.search || "";
    const filter = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

    const generics = await Generic.find(filter)
      .skip(skip)
      .limit(limit);

    const total = await Generic.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return successResponse(res, "Generics fetched successfully", {
      generics,
      currentPage: page,
      totalPages,
      totalItems: total,
      pageSize: limit,
      hasMore,
    });
  } catch (error) {
    console.error("Fetch Generics Error:", error);
    return sendError(res, "Failed to fetch generics", 500);
  }
};

// Get single generic by ID
export const getGenericById = async (req, res) => {
  try {
    const generic = await Generic.findById(req.params.id);
    if (!generic) return sendError(res, "Generic not found", 404);
    return successResponse(res, "Generic fetched", { generic });
  } catch (error) {
    console.error("Get Generic Error:", error);
    return sendError(res, "Error fetching generic", 500);
  }
};

// Create generic
export const createGeneric = async (req, res) => {
  try {
    const { name, short_name } = req.body;
    if (!name) return sendError(res, "Name is required", 400);

    const newGeneric = await Generic.create({ name, short_name });
    return successResponse(res, "Generic created successfully", { generic: newGeneric }, 201);
  } catch (error) {
    console.error("Create Generic Error:", error);
    return sendError(res, "Failed to create generic", 500);
  }
};

// Update generic
export const updateGeneric = async (req, res) => {
  try {
    const { id } = req.params;
    const generic = await Generic.findById(id);
    if (!generic) return sendError(res, "Generic not found", 404);

    const updated = await Generic.findByIdAndUpdate(id, req.body, { new: true });
    return successResponse(res, "Generic updated successfully", { generic: updated });
  } catch (error) {
    console.error("Update Generic Error:", error);
    return sendError(res, "Failed to update generic", 500);
  }
};

// Delete generic
export const deleteGeneric = async (req, res) => {
  try {
    const { id } = req.params;
    const generic = await Generic.findById(id);
    if (!generic) return sendError(res, "Generic not found", 404);

    await generic.deleteOne();
    return successResponse(res, "Generic deleted successfully");
  } catch (error) {
    console.error("Delete Generic Error:", error);
    return sendError(res, "Failed to delete generic", 500);
  }
};

// Search generics (limited)
export const searchGenerics = async (req, res) => {
  try {
    const { search = "" } = req.query;

    const generics = await Generic.find({
      name: { $regex: search, $options: "i" },
    }).limit(10);

    return successResponse(res, "Search results", { generics });
  } catch (error) {
    console.error("Search Generic Error:", error);
    return sendError(res, "Failed to search generics", 500);
  }
};

const genericController = {
  getAllGenerics,
  getGenericById,
  createGeneric,
  updateGeneric,
  deleteGeneric,
  searchGenerics,
};

export default genericController;
