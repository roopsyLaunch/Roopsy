const { z } = require("zod");
const Service = require("../models/Service");
const Barber = require("../models/Barber");

const createSchema = z.object({
  barberId: z.string().length(24),
  name: z.string().min(1),
  category: z.string().optional(),
  durationMinutes: z.number().int().positive(),
  price: z.number().nonnegative(),
  originalPrice: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  images: z.array(z.string()).max(5).optional(),
  isHomeService: z.boolean().optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  price: z.number().nonnegative().optional(),
  originalPrice: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  images: z.array(z.string()).max(5).optional(),
  isHomeService: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

function mapService(s) {
  return {
    id: s._id,
    barberId: s.barberId,
    name: s.name,
    category: s.category,
    durationMinutes: s.durationMinutes,
    price: s.price,
    originalPrice: s.originalPrice || s.price || 0,
    discountAmount: s.discountAmount || 0,
    images: s.images || [],
    isHomeService: !!s.isHomeService,
    isActive: s.isActive !== false,
  };
}

async function list(req, res) {
  const { barberId, category } = req.query;
  const filter = {};
  if (barberId) {
    filter.barberId = barberId;
  }
  if (category) {
    filter.category = category;
  }
  const services = await Service.find(filter).sort({ category: 1, name: 1 });
  res.json({
    services: services.map(mapService),
  });
}

async function create(req, res) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const barber = await Barber.findById(parsed.data.barberId);
  if (!barber) {
    return res.status(404).json({ error: "Barber not found" });
  }
  if (barber.userId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    return res.status(403).json({ error: "You can only add services to your own profile" });
  }
  const s = await Service.create(parsed.data);
  res.status(201).json({
    service: mapService(s),
  });
}

async function update(req, res) {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const service = await Service.findById(req.params.id);
  if (!service) {
    return res.status(404).json({ error: "Service not found" });
  }
  const barber = await Barber.findById(service.barberId);
  if (!barber) {
    return res.status(404).json({ error: "Barber not found" });
  }
  if (barber.userId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  Object.assign(service, parsed.data);
  await service.save();
  res.json({ service: mapService(service) });
}

async function remove(req, res) {
  const service = await Service.findById(req.params.id);
  if (!service) {
    return res.status(404).json({ error: "Service not found" });
  }
  const barber = await Barber.findById(service.barberId);
  if (!barber) {
    return res.status(404).json({ error: "Barber not found" });
  }
  if (barber.userId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  await service.deleteOne();
  res.json({ ok: true });
}

module.exports = { list, create, update, remove };
