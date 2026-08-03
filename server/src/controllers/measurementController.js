const MeasurementProfile = require("../models/MeasurementProfile");

exports.createProfile = async (req, res) => {
  try {
    const { profileName, gender, measurementType, standardSize, unit, measurements } = req.body;
    
    if (!profileName) {
      return res.status(400).json({ error: "Profile name is required." });
    }
    
    const profile = await MeasurementProfile.create({
      userId: req.user._id,
      profileName,
      gender,
      measurementType,
      standardSize,
      unit,
      measurements
    });
    
    res.status(201).json({ profile });
  } catch (error) {
    console.error("Create Measurement Error:", error);
    res.status(500).json({ error: "Failed to create measurement profile." });
  }
};

exports.getProfiles = async (req, res) => {
  try {
    const profiles = await MeasurementProfile.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ profiles });
  } catch (error) {
    console.error("Get Measurements Error:", error);
    res.status(500).json({ error: "Failed to fetch profiles." });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const profile = await MeasurementProfile.findOne({ _id: req.params.id, userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ error: "Profile not found." });
    }

    const updates = req.body;
    // only update allowed fields
    ["profileName", "gender", "measurementType", "standardSize", "unit", "measurements"].forEach(key => {
      if (updates[key] !== undefined) {
        profile[key] = updates[key];
      }
    });

    await profile.save();
    res.json({ profile });
  } catch (error) {
    console.error("Update Measurement Error:", error);
    res.status(500).json({ error: "Failed to update profile." });
  }
};

exports.deleteProfile = async (req, res) => {
  try {
    const deleted = await MeasurementProfile.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!deleted) {
      return res.status(404).json({ error: "Profile not found." });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("Delete Measurement Error:", error);
    res.status(500).json({ error: "Failed to delete profile." });
  }
};
