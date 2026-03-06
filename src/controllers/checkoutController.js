import Order from "../models/cartModel.js";
import OrderDetail from "../models/checkoutModel.js";
import Item from "../models/itemModel.js";

export const addToCheckout = async (req, res) => {
  const userId = req.user.id;
  const { rental_date, rental_hour, return_date, status, item_id, quantity } =
    req.body;
  try {
    const regex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!regex.test(rental_hour)) {
      return res
        .status(400)
        .json({ message: "Format jam sewa haru HH:mm, misal 11:30" });
    }

    const rentalDateTime = new Date(`${rental_date}T${rental_hour}:00`);
    const returnDateTime = new Date(`${return_date}T${rental_hour}:00`);

    const durationMs = returnDateTime - rentalDateTime;
    if (durationMs <= 0) {
      return res.status(400).json({
        message: "Tanggal kembali harus setelah tanggal sewa",
      });
    }

    const order = await Order.create({
      user_id: userId,
      status,
      subtotal: 0,
    });

    const item = await Item.findById(item_id);

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (item.stock < quantity) {
      return res.status(400).json({
        message: `Stok ${item.item_name} tidak mencukupi`,
      });
    }
    await Item.update(item.id, {
      stock: { decrement: quantity },
      status: item.stock - quantity === 0 ? "Disewa" : "Tersedia",
    });

    const price = item.rental_price;
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
    const itemSubtotal = price * quantity * durationDays;

    const orderDetail = await OrderDetail.create({
      order_id: order.id,
      item_id,
      rental_date: new Date(rental_date),
      rental_hour: rental_hour,
      return_date: new Date(return_date),
      return_hour: rental_hour,
      quantity,
      price,
      duration: durationDays,
      subtotal: itemSubtotal,
      status: "Tertunda",
    });

    const totalSubtotal = await OrderDetail.amountSubtotal(order.id);

    await Order.update(order.id, {
      subtotal: totalSubtotal._sum.subtotal || 0,
    });

    res.status(201).json({
      status: true,
      message: "Item successfully processed",
      orderDetail,
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllDataCheckout = async (req, res) => {
  const userId = req.user.id;
  try {
    const OrderData = await Order.findAllDataCheckout(userId);
    res.status(200).json(OrderData);
  } catch (err) {
    console.error("Error getting checkout:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllPendingCheckoutByUser = async (req, res) => {
  const userId = req.user.id;
  try {
    const OrderData = await Order.findAllPendingCheckoutByUser(userId);
    res.status(200).json(OrderData);
  } catch (err) {
    console.error("Error getting checkout:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllRentedCheckoutByUser = async (req, res) => {
  const userId = req.user.id;
  try {
    const OrderData = await Order.findAllRentedCheckoutByUser(userId);
    res.status(200).json(OrderData);
  } catch (err) {
    console.error("Error getting checkout:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllFinishedCheckoutByUser = async (req, res) => {
  const userId = req.user.id;
  try {
    const OrderData = await Order.findAllFinishedCheckoutByUser(userId);
    res.status(200).json(OrderData);
  } catch (err) {
    console.error("Error getting checkout:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllCanceledCheckoutByUser = async (req, res) => {
  const userId = req.user.id;
  try {
    const OrderData = await Order.findAllCanceledCheckoutByUser(userId);
    res.status(200).json(OrderData);
  } catch (err) {
    console.error("Error getting checkout:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllPendingCheckout = async (_req, res) => {
  try {
    const OrderData = await Order.findAllPendingCheckout();
    res.status(200).json(OrderData);
  } catch (err) {
    console.error("Error getting checkout:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllRentedCheckout = async (_req, res) => {
  try {
    const OrderData = await Order.findAllRentedCheckout();
    res.status(200).json(OrderData);
  } catch (err) {
    console.error("Error getting checkout:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllFinishedCheckout = async (_req, res) => {
  try {
    const OrderData = await Order.findAllFinishedCheckout();
    res.status(200).json(OrderData);
  } catch (err) {
    console.error("Error getting checkout:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllCanceledCheckout = async (_req, res) => {
  try {
    const OrderData = await Order.findAllCanceledCheckout();
    res.status(200).json(OrderData);
  } catch (err) {
    console.error("Error getting checkout:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const approveOrder = async (req, res) => {
  const { id } = req.params;
  try {
    const order = await Order.findPendingByOrderId(id);

    if (!order) {
      return res.status(404).json({
        message: "Order tidak ditemukan",
      });
    }

    await Order.updateStatusToRented(id);

    return res.status(200).json({
      status: true,
      message: "Order successfully approved",
    });
  } catch (error) {
    console.error("Approve order error:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const cancelOrder = async (req, res) => {
  const { id } = req.params;
  try {
    const order = await Order.findPendingByOrderId(id);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    for (const detail of order.details) {
      await Item.update(detail.item_id, {
        where: { id: detail.item_id },
        stock: { increment: detail.quantity },
        status:
          detail.item.stock + detail.quantity === 0 ? "Disewa" : "Tersedia",
      });
    }

    await Order.updateStatusToCanceled(id);

    return res.status(200).json({
      status: true,
      message: "Order cancellation successful",
    });
  } catch (error) {
    console.error("Cancel order error:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const finishOrder = async (req, res) => {
  const userId = req.user.id;
  const { order_detail_ids } = req.body;

  if (!order_detail_ids || order_detail_ids.length === 0) {
    return res.status(400).json({
      message: "Pilih minimal 1 item untuk checkout",
    });
  }

  try {
    const order = await Order.findRentedByUserId(userId, order_detail_ids);
    if (!order) {
      return res.status(404).json({
        message: "Data not found",
      });
    }

    const details = await OrderDetail.findRentedByOrderId(
      order_detail_ids,
      userId,
    );

    for (const detail of details) {
      await Item.update(detail.item_id, {
        stock: { increment: detail.quantity },
        status:
          detail.item.stock + detail.quantity === 0 ? "Disewa" : "Tersedia",
      });
    }

    const newOrder = await Order.create({
      user_id: userId,
      status: "Selesai",
    });

    const moveResult = await OrderDetail.moveOrderDetailsToOrder(
      order_detail_ids,
      newOrder.id,
    );

    if (moveResult.count === 0) {
      return res.status(400).json({
        message: "Item yang dipilih tidak valid",
      });
    }

    const newSubtotal = await OrderDetail.amountRentedSubtotal(order.id);

    await Order.update(order.id, {
      subtotal: newSubtotal._sum.subtotal || 0,
    });

    const totalSubtotal = await OrderDetail.amountSubtotal(newOrder.id);

    await Order.update(newOrder.id, {
      subtotal: totalSubtotal._sum.subtotal || 0,
    });

    const remainingDetails = await OrderDetail.numberOfDetail(order.id);

    if (remainingDetails === 0) {
      await Order.delete(order.id);
    }

    res.status(200).json({
      status: true,
      message: "Complete the order successfully",
      data: {
        order_id: newOrder.id,
        subtotal: totalSubtotal._sum.subtotal || 0,
      },
    });
  } catch (error) {
    console.error("Finish order error:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};
