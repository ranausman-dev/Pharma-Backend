import PackSize from "../models/packSizeModel.js";
import { sendError, successResponse } from "../utils/response.js";

// Get paginated pack sizes
export const getAllPackSizes = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const search = req.query.search || "";
        const filter = search
            ? { name: { $regex: search, $options: "i" } }
            : {};

        const packSizes = await PackSize.find(filter)
            .skip(skip)
            .limit(limit);

        const total = await PackSize.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);
        const hasMore = page < totalPages;

        return successResponse(res, "Pack sizes fetched successfully", {
            packSizes,
            currentPage: page,
            totalPages,
            totalItems: total,
            pageSize: limit,
            hasMore,
        });
    } catch (error) {
        console.error("Fetch Pack Sizes Error:", error);
        return sendError(res, "Failed to fetch pack sizes", 500);
    }
};

// Get single pack size by ID
export const getPackSizeById = async (req, res) => {
    try {
        const packSize = await PackSize.findById(req.params.id);
        if (!packSize) return sendError(res, "Pack size not found", 404);
        return successResponse(res, "Pack size fetched", { packSize });
    } catch (error) {
        console.error("Get Pack Size Error:", error);
        return sendError(res, "Error fetching pack size", 500);
    }
};

// Create pack size
export const createPackSize = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return sendError(res, "Name is required", 400);

        // Check if a pack size with the same name already exists (case-insensitive)
        const existing = await PackSize.findOne({ name: { $regex: `^${name}$`, $options: "i" } });
        if (existing) return sendError(res, "Pack size already exists", 409);

        const newPackSize = await PackSize.create({ name });
        return successResponse(res, "Pack size created successfully", { packSize: newPackSize }, 201);
    } catch (error) {
        console.error("Create Pack Size Error:", error);
        return sendError(res, "Failed to create pack size", 500);
    }
};


// Update pack size
export const updatePackSize = async (req, res) => {
    try {
        const { id } = req.params;
        const packSize = await PackSize.findById(id);
        if (!packSize) return sendError(res, "Pack size not found", 404);

        const updated = await PackSize.findByIdAndUpdate(id, req.body, { new: true });
        return successResponse(res, "Pack size updated successfully", { packSize: updated });
    } catch (error) {
        console.error("Update Pack Size Error:", error);
        return sendError(res, "Failed to update pack size", 500);
    }
};

// Delete pack size
export const deletePackSize = async (req, res) => {
    try {
        const { id } = req.params;
        const packSize = await PackSize.findById(id);
        if (!packSize) return sendError(res, "Pack size not found", 404);

        await packSize.deleteOne();
        return successResponse(res, "Pack size deleted successfully");
    } catch (error) {
        console.error("Delete Pack Size Error:", error);
        return sendError(res, "Failed to delete pack size", 500);
    }
};

// Search pack sizes
export const searchPackSizes = async (req, res) => {
    try {
        const { search = "" } = req.query;

        const packSizes = await PackSize.find({
            name: { $regex: search, $options: "i" },
        }).limit(10);

        return successResponse(res, "Search results", { packSizes });
    } catch (error) {
        console.error("Search Pack Size Error:", error);
        return sendError(res, "Failed to search pack sizes", 500);
    }
};

const packSizeController = {
    getAllPackSizes,
    getPackSizeById,
    createPackSize,
    updatePackSize,
    deletePackSize,
    searchPackSizes,
};

export default packSizeController;
