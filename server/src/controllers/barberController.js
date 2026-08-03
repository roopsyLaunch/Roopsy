const { z } = require("zod");
const Barber = require("../models/Barber");
const Service = require("../models/Service");
const Booking = require("../models/Booking");
const { buildSeats } = require("../utils/barberSeats");
const { haversineDistance } = require("../utils/distance");

function calculateIsShopOpen(b) {
  if (b.autoShopStatus && b.dailyOpenTime && b.dailyCloseTime) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
      const parts = formatter.formatToParts(new Date());
      let hour = parts.find(p => p.type === 'hour').value;
      const minute = parts.find(p => p.type === 'minute').value;
      if (hour === '24') hour = '00';
      const currentTime = `${hour}:${minute}`;
      
      // Handle cases where close time is past midnight (e.g., open 21:00, close 02:00)
      if (b.dailyOpenTime > b.dailyCloseTime) {
        return currentTime >= b.dailyOpenTime || currentTime <= b.dailyCloseTime;
      }
      return currentTime >= b.dailyOpenTime && currentTime <= b.dailyCloseTime;
    } catch (e) {
      console.error("Time calc error", e);
    }
  }
  return b.isShopOpen;
}

function publicBarberCard(b) {
  return {
    id: b._id,
    shopName: b.shopName,
    businessCategory: b.businessCategory,
    ownerName: b.ownerName,
    mobileNumber: b.mobileNumber,
    gallery: b.gallery || [],
    bio: b.bio,
    avatarUrl: b.avatarUrl,
    shopPosterUrl: b.shopPosterUrl,
    address: b.address,
    location: b.location,
    seatCount: b.seatCount,
    seats: b.seats || [],
    isShopOpen: calculateIsShopOpen(b),
    autoShopStatus: b.autoShopStatus || false,
    dailyOpenTime: b.dailyOpenTime || "09:00",
    dailyCloseTime: b.dailyCloseTime || "21:00",
    offersHomeService: b.offersHomeService || false,
    homeServiceFee: b.homeServiceFee || 0,
    workingHours: b.workingHours,
    user: b.userId
      ? {
          id: b.userId._id,
          name: b.userId.name,
          phone: b.userId.phone,
        }
      : null,
    minPrice: b.minPrice || 0,
    serviceImages: b.serviceImages || [],
    distance: b.distance,
    availableSeats: b.availableSeats || 0,
    staff: b.staff || [],
    pauseBookings: !!b.pauseBookings,
    averageRating: b.ratingCount ? (b.ratingSum / b.ratingCount).toFixed(1) : "0.0",
    ratingCount: b.ratingCount || 0,
    maxAdvanceBookingDays: b.maxAdvanceBookingDays || 1,
  };
}

function ownerBarberDetail(b) {
  return {
    id: b._id,
    approvalStatus: b.approvalStatus,
    rejectionReason: b.rejectionReason,
    shopName: b.shopName,
    businessCategory: b.businessCategory,
    ownerName: b.ownerName,
    mobileNumber: b.mobileNumber,
    gallery: b.gallery || [],
    bio: b.bio,
    avatarUrl: b.avatarUrl,
    shopPosterUrl: b.shopPosterUrl,
    address: b.address,
    location: b.location,
    seatCount: b.seatCount,
    seats: b.seats || [],
    isShopOpen: calculateIsShopOpen(b),
    autoShopStatus: b.autoShopStatus || false,
    dailyOpenTime: b.dailyOpenTime || "09:00",
    dailyCloseTime: b.dailyCloseTime || "21:00",
    offersHomeService: b.offersHomeService || false,
    homeServiceFee: b.homeServiceFee || 0,
    aadhaarLast4: b.aadhaarLast4,
    bank: b.bank || {},
    workingHours: b.workingHours,
    lunchTime: b.lunchTime,
    staff: b.staff || [],
    breaks: b.breaks || [],
    pauseBookings: !!b.pauseBookings,
    maxAdvanceBookingDays: b.maxAdvanceBookingDays || 1,
  };
}

async function list(req, res) {
  const { category, city, maxPrice, businessContext, lat, lng } = req.query;

  const query = { approvalStatus: "approved" };

  if (businessContext && businessContext.toLowerCase() !== "all") {
    if (businessContext.toLowerCase() === "barber") {
       query.businessCategory = { $regex: /barber/i };
    } else if (businessContext.toLowerCase() === "beauty_parlor") {
       query.businessCategory = { $regex: /beauty/i };
    } else if (businessContext.toLowerCase() === "stitching") {
       query.businessCategory = { $regex: /tailor|stitching/i };
    }
  }

  if (category && category.toLowerCase() !== "all") {
    if (category.toLowerCase() === "home_service") {
       const homeServices = await Service.find({ isHomeService: true }).lean();
       const homeBarberIds = homeServices.map(s => s.barberId);
       query._id = { $in: homeBarberIds };
    } else if (category.toLowerCase() === "barber") {
       query.businessCategory = { $regex: /barber/i };
       const normalServices = await Service.find({ isHomeService: { $ne: true } }).lean();
       const normalBarberIds = normalServices.map(s => s.barberId);
       if (query._id && query._id.$in) {
         query._id.$in = query._id.$in.filter(id => normalBarberIds.some(nId => nId.toString() === id.toString()));
       } else {
         query._id = { $in: normalBarberIds };
       }
    } else if (category.toLowerCase() === "stitching" || category.toLowerCase() === "tailor") {
       query.businessCategory = { $regex: /tailor|stitching/i };
    } else if (category.toLowerCase() === "beauty_parlor") {
       query.businessCategory = { $regex: /beauty/i };
    } else {
       query.businessCategory = { $regex: new RegExp(category, "i") };
    }
  }

  if (city) {
    query["address.city"] = { $regex: new RegExp(city, "i") };
  }

  let barbers = await Barber.find(query)
    .populate("userId", "name email phone")
    .sort({ createdAt: -1 })
    .lean();

  const barberIds = barbers.map(b => b._id);
  const services = await Service.find({ barberId: { $in: barberIds } }).lean();

  const priceMap = {};
  for (const s of services) {
    if (!priceMap[s.barberId]) priceMap[s.barberId] = [];
    priceMap[s.barberId].push(s.price);
  }

  const parsedMaxPrice = maxPrice ? parseFloat(maxPrice) : null;

  barbers = barbers.map(b => {
    const prices = priceMap[b._id.toString()] || [];
    b.minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    
    // Collect up to 3 images from services for the barber card
    const sImages = [];
    for (const s of services) {
      if (s.barberId.toString() === b._id.toString() && s.images && s.images.length > 0) {
        sImages.push(...s.images);
      }
    }
    b.serviceImages = [...new Set(sImages)].slice(0, 3);
    
    // Calculate distance if lat/lng are provided
    if (lat && lng && b.location && b.location.lat != null && b.location.lng != null) {
      b.distance = haversineDistance({ lat: parseFloat(lat), lng: parseFloat(lng) }, b.location);
    } else {
      b.distance = Infinity;
    }

    // Calculate available seats
    b.availableSeats = 0;
    if (calculateIsShopOpen(b) && b.seats) {
      const now = new Date();
      b.availableSeats = b.seats.filter(s => 
        s.isAvailable || (s.occupiedUntil && new Date(s.occupiedUntil) <= now)
      ).length;
    }
    
    return b;
  });

  if (parsedMaxPrice !== null && !isNaN(parsedMaxPrice)) {
    barbers = barbers.filter(b => b.minPrice > 0 && b.minPrice <= parsedMaxPrice);
  }

  // Smart Ranking:
  // 1. Open and has available seats
  // 2. Distance (closest first)
  // 3. Price (lowest first)
  barbers.sort((a, b) => {
    const aAvailable = a.availableSeats > 0 ? 1 : 0;
    const bAvailable = b.availableSeats > 0 ? 1 : 0;
    
    if (aAvailable !== bAvailable) {
      return bAvailable - aAvailable; // Available first
    }
    
    if (a.distance !== b.distance) {
      return a.distance - b.distance; // Closest first
    }
    
    return a.minPrice - b.minPrice; // Lowest price first
  });

  res.json({ barbers: barbers.map(publicBarberCard) });
}

async function getById(req, res) {
  const barber = await Barber.findById(req.params.id).populate("userId", "name email phone");
  if (!barber) {
    return res.status(404).json({ error: "Barber not found" });
  }
  const requester = req.user || null;
  const uid = barber.userId && barber.userId._id ? barber.userId._id : barber.userId;
  const isOwner = requester && uid && uid.toString() === requester._id.toString();
  const isAdmin = requester && requester.role === "admin";
  if (barber.approvalStatus !== "approved" && !isOwner && !isAdmin) {
    return res.status(404).json({ error: "Barber not found" });
  }
  const services = await Service.find({ barberId: barber._id }).sort({ category: 1, name: 1 });
  const card = publicBarberCard(barber);
  res.json({
    barber: card,
    services: services.map((s) => ({
      id: s._id,
      name: s.name,
      category: s.category,
      durationMinutes: s.durationMinutes,
      price: s.price,
      originalPrice: s.originalPrice || s.price || 0,
      discountAmount: s.discountAmount || 0,
      images: s.images || [],
      isHomeService: !!s.isHomeService,
      isActive: s.isActive !== false,
    })),
  });
}

const updateSchema = z.object({
  shopName: z.string().min(1).optional(),
  businessCategory: z.string().optional(),
  ownerName: z.string().optional(),
  mobileNumber: z.string().optional(),
  gallery: z.array(z.string()).optional(),
  bio: z.string().optional(),
  shopPosterUrl: z.string().optional(),
  avatarUrl: z.string().optional(),
  address: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      pincode: z.string().optional(),
    })
    .optional(),
  location: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional()
    .nullable(),
  seatCount: z.number().int().min(1).max(50).optional(),
  seats: z
    .array(
      z.object({
        index: z.number(),
        label: z.string().optional(),
        isAvailable: z.boolean(),
        occupiedUntil: z.string().nullable().optional(),
      })
    )
    .optional(),
  isShopOpen: z.boolean().optional(),
  autoShopStatus: z.boolean().optional(),
  dailyOpenTime: z.string().regex(/^([01]\d|2[0-3]):?([0-5]\d)$/).optional(),
  dailyCloseTime: z.string().regex(/^([01]\d|2[0-3]):?([0-5]\d)$/).optional(),
  offersHomeService: z.boolean().optional(),
  homeServiceFee: z.number().min(0).optional(),
  workingHours: z.record(z.any()).optional(),
  lunchTime: z.object({
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    isActive: z.boolean().optional()
  }).optional(),
  staff: z.array(z.object({
    name: z.string(),
    role: z.string().optional(),
    avatarUrl: z.string().optional()
  })).optional(),
  aadhaarLast4: z.string().regex(/^\d{4}$/).optional(),
  bank: z
    .object({
      accountHolderName: z.string().optional(),
      accountNumber: z.string().optional(),
      ifsc: z.string().optional(),
      upiId: z.string().optional(),
    })
    .optional(),
  maxAdvanceBookingDays: z.number().int().min(1).max(60).optional(),
});

async function getMine(req, res) {
  let barber = await Barber.findOne({ userId: req.user._id }).populate("userId", "name email phone");
  if (!barber) {
    if (req.user.role === "barber") {
      const { buildSeats } = require("../utils/barberSeats");
      barber = await Barber.create({
        userId: req.user._id,
        approvalStatus: "approved", // auto-approve for testing
        seatCount: 1,
        seats: buildSeats(1)
      });
      barber = await Barber.findOne({ userId: req.user._id }).populate("userId", "name email phone");
    } else {
      return res.status(404).json({ error: "Barber profile not found" });
    }
  }
  const services = await Service.find({ barberId: barber._id }).sort({ category: 1, name: 1 });
  res.json({
    barber: ownerBarberDetail(barber),
    services: services.map((s) => ({
      id: s._id,
      name: s.name,
      category: s.category,
      durationMinutes: s.durationMinutes,
      price: s.price,
      images: s.images || [],
      isHomeService: !!s.isHomeService,
      isActive: s.isActive !== false,
    })),
  });
}

async function updateMine(req, res) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const barber = await Barber.findOne({ userId: req.user._id });
  if (!barber) {
    return res.status(404).json({ error: "Barber profile not found" });
  }
  const p = parsed.data;
  if (p.shopName !== undefined) barber.shopName = p.shopName;
  if (p.businessCategory !== undefined) barber.businessCategory = p.businessCategory;
  if (p.ownerName !== undefined) barber.ownerName = p.ownerName;
  if (p.mobileNumber !== undefined) barber.mobileNumber = p.mobileNumber;
  if (p.gallery !== undefined) barber.gallery = p.gallery;
  if (p.bio !== undefined) barber.bio = p.bio;
  if (p.shopPosterUrl !== undefined) barber.shopPosterUrl = p.shopPosterUrl;
  if (p.avatarUrl !== undefined) barber.avatarUrl = p.avatarUrl;
  if (p.address) {
    const cur = barber.address && typeof barber.address === "object" ? barber.address : {};
    barber.address = { ...cur, ...p.address };
  }
  if (p.location !== undefined) {
    barber.location = p.location || undefined;
  }
  if (p.seatCount !== undefined) {
    const oldSeats = barber.seats || [];
    barber.seatCount = p.seatCount;
    const newSeats = buildSeats(p.seatCount);
    newSeats.forEach((ns, i) => {
      if (i < oldSeats.length) {
        ns.isAvailable = oldSeats[i].isAvailable;
        ns.status = oldSeats[i].isAvailable ? "available" : "occupied";
        ns.occupiedUntil = oldSeats[i].occupiedUntil;
      }
    });
    barber.seats = newSeats;
  }
  if (p.seats !== undefined) {
    barber.seats = p.seats.map((s, i) => ({
      index: s.index ?? i,
      label: s.label || `Chair ${(s.index ?? i) + 1}`,
      isAvailable: s.isAvailable,
      status: s.isAvailable ? "available" : "occupied",
      occupiedUntil: s.occupiedUntil ? new Date(s.occupiedUntil) : null,
    }));
  }
  if (p.isShopOpen !== undefined) barber.isShopOpen = p.isShopOpen;
  if (p.autoShopStatus !== undefined) barber.autoShopStatus = p.autoShopStatus;
  if (p.dailyOpenTime !== undefined) barber.dailyOpenTime = p.dailyOpenTime;
  if (p.dailyCloseTime !== undefined) barber.dailyCloseTime = p.dailyCloseTime;
  if (p.offersHomeService !== undefined) barber.offersHomeService = p.offersHomeService;
  if (p.homeServiceFee !== undefined) barber.homeServiceFee = p.homeServiceFee;
  if (p.staff !== undefined) barber.staff = p.staff;
  
  if (p.lunchTime !== undefined) {
    const cur = barber.lunchTime && typeof barber.lunchTime === "object" ? barber.lunchTime : {};
    barber.lunchTime = { ...cur, ...p.lunchTime };
  }

  // Auto-approve logic removed. Admin must approve.
  if (p.workingHours !== undefined) {
    if (!barber.workingHours) barber.workingHours = {};
    for (const [day, data] of Object.entries(p.workingHours)) {
      if (barber.workingHours[day]) {
        barber.workingHours[day].open = data.open;
        barber.workingHours[day].close = data.close;
        barber.workingHours[day].isClosed = data.isClosed;
      } else {
        barber.workingHours[day] = { open: data.open, close: data.close, isClosed: data.isClosed };
      }
    }
    barber.markModified('workingHours');
  }
  if (p.aadhaarLast4 !== undefined) barber.aadhaarLast4 = p.aadhaarLast4;
  if (p.bank !== undefined) {
    const cur = barber.bank && typeof barber.bank === "object" ? barber.bank : {};
    barber.bank = { ...cur, ...p.bank };
  }
  if (p.maxAdvanceBookingDays !== undefined) {
    barber.maxAdvanceBookingDays = p.maxAdvanceBookingDays;
  }
  await barber.save();
  
  const io = req.app.get("io");
  if (io) {
    io.to(`barber_${barber._id.toString()}`).emit("slotsUpdated", { seats: barber.seats });
  }

  res.json({ barber: ownerBarberDetail(barber) });
}

async function upgrade(req, res) {
  const { category } = req.body;
  
  if (req.user.role === "admin") {
    return res.status(403).json({ error: "Admins cannot become partners" });
  }
  
  if (req.user.role === "barber") {
    return res.status(400).json({ error: "You are already a partner" });
  }

  const User = require("../models/User");
  const user = await User.findById(req.user._id);
  user.role = "barber";
  await user.save();

  const seatCount = 1;
  const seats = buildSeats(seatCount);
  const bio = category ? `${category}. Welcome to our new service center.` : "Welcome to our shop.";
  
  const barberDoc = await Barber.create({
    userId: user._id,
    approvalStatus: "pending", // admin must approve barbers
    businessCategory: category || "Barber Shop",
    shopName: `${user.name}'s Shop`,
    bio: bio,
    shopPosterUrl: "",
    address: { line1: "", city: "", state: "", pincode: "" },
    location: null,
    seatCount,
    seats,
    aadhaarLast4: "",
    bank: {},
  });

  const { signToken } = require("../utils/jwt");
  const newToken = signToken({ sub: user._id.toString(), role: "barber" });

  res.json({
    token: newToken,
    barber: ownerBarberDetail(barberDoc),
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
    }
  });
}

async function getAnalytics(req, res) {
  const barber = await Barber.findOne({ userId: req.user.id });
  if (!barber) return res.json({ todayRevenue: 0, todayCustomers: 0, activeQueue: 0, completedServices: 0, walkIns: 0, onlineBookings: 0, noShows: 0, cancelled: 0, avgWait: 0, avgServiceTime: 0, weeklyData: [0, 0, 0, 0, 0, 0, 0] });

  const range = req.query.range || "today"; // "today", "week", "month"

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let startDate = today;
  let endDate = tomorrow;

  if (range === "week") {
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    startDate = weekAgo;
  } else if (range === "month") {
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 29);
    startDate = monthAgo;
  }

  // Bookings in range
  const bookingsInRange = await Booking.find({
    barberId: barber._id,
    startTime: { $gte: startDate, $lt: endDate },
    status: { $in: ["completed", "in-progress", "confirmed", "arrived", "pending", "no-show", "cancelled"] }
  }).populate("serviceIds");

  let todayRevenue = 0;
  let todayCustomers = 0;
  let activeQueue = 0;
  let completedServices = 0;
  let walkIns = 0;
  let onlineBookings = 0;
  let noShows = 0;
  let cancelled = 0;
  let totalWaitTime = 0;
  let waitCount = 0;
  let totalServiceTime = 0;
  let serviceCount = 0;

  bookingsInRange.forEach(b => {
    if (b.status === "completed") {
      let price = 0;
      if (b.serviceIds) {
        b.serviceIds.forEach(s => price += (s.price || 0));
      }
      todayRevenue += price;
      completedServices++;
    } else if (["pending", "confirmed", "arrived", "in-progress"].includes(b.status)) {
      activeQueue++;
    }

    if (b.status === "no-show") noShows++;
    if (b.status === "cancelled") cancelled++;
    
    if (b.isWalkIn) walkIns++;
    else onlineBookings++;
    
    if (["completed", "in-progress", "arrived"].includes(b.status)) {
       todayCustomers++;
    }

    if (b.arrivedAt && b.startedAt) {
      totalWaitTime += (b.startedAt.getTime() - b.arrivedAt.getTime()) / 60000;
      waitCount++;
    }
    
    if (b.startedAt && b.completedAt) {
      totalServiceTime += (b.completedAt.getTime() - b.startedAt.getTime()) / 60000;
      serviceCount++;
    }
  });

  const avgWait = waitCount > 0 ? Math.floor(totalWaitTime / waitCount) : 0;
  const avgServiceTime = serviceCount > 0 ? Math.floor(totalServiceTime / serviceCount) : 0;

  // Calculate Weekly Revenue (last 7 days)
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  
  const weeklyBookings = await Booking.find({
    barberId: barber._id,
    startTime: { $gte: weekAgo, $lt: tomorrow },
    status: "completed"
  }).populate("serviceIds");

  const weeklyData = [0, 0, 0, 0, 0, 0, 0];
  weeklyBookings.forEach(b => {
    const d = new Date(b.startTime);
    const diff = Math.floor((today.getTime() - d.getTime()) / (1000 * 3600 * 24));
    if (diff >= 0 && diff < 7) {
      let price = 0;
      if (b.serviceIds) {
         b.serviceIds.forEach(s => price += (s.price || 0));
      }
      weeklyData[6 - diff] += price;
    }
  });

  res.json({
    todayRevenue,
    todayCustomers,
    activeQueue,
    completedServices,
    walkIns,
    onlineBookings,
    noShows,
    cancelled,
    avgWait,
    avgServiceTime,
    weeklyData
  });
}


async function exportReport(req, res) {
  const barber = await Barber.findOne({ userId: req.user.id });
  if (!barber) return res.status(404).json({ error: "Not found" });

  const { format } = req.query;

  const bookings = await Booking.find({
    barberId: barber._id,
    status: "completed"
  }).populate("serviceIds").populate("customerId").sort({ startTime: -1 });

  if (format === 'excel') {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Bookings Report');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 25 },
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Customer', key: 'customer', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Services', key: 'services', width: 40 },
      { header: 'Amount', key: 'amount', width: 10 },
    ];

    bookings.forEach(b => {
      let price = 0;
      let svcs = [];
      if (b.serviceIds) {
         b.serviceIds.forEach(s => { price += (s.price || 0); svcs.push(s.name); });
      }
      sheet.addRow({
        id: b._id.toString(),
        date: new Date(b.startTime).toLocaleString(),
        customer: b.customerId ? b.customerId.name : (b.guestName || ''),
        phone: b.customerId ? b.customerId.phone : (b.guestPhone || ''),
        services: svcs.join(" + "),
        amount: price
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=' + 'report.xlsx');
    return workbook.xlsx.write(res).then(() => {
      res.status(200).end();
    });
  } else if (format === 'pdf') {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=' + 'report.pdf');
    doc.pipe(res);

    doc.fontSize(20).text('Bookings Report', { align: 'center' });
    doc.moveDown();

    bookings.forEach(b => {
       let price = 0;
       let svcs = [];
       if (b.serviceIds) {
          b.serviceIds.forEach(s => { price += (s.price || 0); svcs.push(s.name); });
       }
       const cust = b.customerId ? b.customerId.name : (b.guestName || 'Walk-In');
       const date = new Date(b.startTime).toLocaleString();
       doc.fontSize(12).text(`Date: ${date} | Customer: ${cust} | Services: ${svcs.join(", ")} | Total: $${price}`);
       doc.moveDown(0.5);
    });
    
    doc.end();
  } else {
    // Default CSV
    let csv = "ID,Date,Customer Name,Phone,Services,Amount\\n";
    bookings.forEach(b => {
      const d = new Date(b.startTime).toLocaleString();
      let price = 0;
      let svcs = [];
      if (b.serviceIds) {
         b.serviceIds.forEach(s => { price += (s.price || 0); svcs.push(s.name); });
      }
      const cust = b.customerId ? b.customerId.name : (b.guestName || '');
      const phone = b.customerId ? b.customerId.phone : (b.guestPhone || '');
      csv += `${b._id},${d},${cust},${phone},${svcs.join(" + ")},${price}\\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('report.csv');
    res.send(csv);
  }
}

async function getCustomerHistory(req, res) {
  const { phone } = req.params;
  const barber = await Barber.findOne({ userId: req.user.id });
  if (!barber) return res.status(404).json({ error: "Not found" });

  const history = await Booking.find({
    barberId: barber._id,
    "customer.phone": phone,
    status: "completed"
  }).populate("serviceIds").sort({ startTime: -1 });

  res.json({ history });
}

module.exports = { list, getById, getMine, updateMine, upgrade, publicBarberCard, ownerBarberDetail, getAnalytics, exportReport, getCustomerHistory };
