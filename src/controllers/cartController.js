import Order from "../models/cartModel.js";
import OrderDetail from "../models/checkoutModel.js";
import Item from "../models/itemModel.js";

export const addToCart = async (req, res) => {
  const userId = req.user.id;
  const { rental_date, rental_hour, return_date, status, item_id, quantity } =
    req.body;
  try {
    let order = await Order.findCartById(userId);

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

    if (!order) {
      order = await Order.create({
        user_id: userId,
        status,
        subtotal: 0,
      });
    }

    const item = await Item.findById(item_id);

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (item.stock < quantity) {
      return res.status(400).json({
        message: `Stok ${item.item_name} tidak mencukupi`,
      });
    }

    const price = item.rental_price;
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
    const itemSubtotal = price * quantity * durationDays;

    const orderDetail = await OrderDetail.create({
      order_id: order.id,
      item_id,
      status: "Keranjang",
      rental_date: new Date(rental_date),
      rental_hour: rental_hour,
      return_date: new Date(return_date),
      return_hour: rental_hour,
      quantity,
      price,
      duration: durationDays,
      subtotal: itemSubtotal,
    });

    const totalSubtotal = OrderDetail.amountSubtotal(order.id);

    await Order.update(order.id, {
      subtotal: totalSubtotal._sum.subtotal || 0,
    });

    res.status(201).json({
      status: true,
      message: "Item successfully added to cart",
      orderDetail,
    });
  } catch (error) {
    console.error("Error added to cart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllCart = async (req, res) => {
  const userId = req.user.id;
  try {
    const OrderData = await Order.findAllCart(userId);
    res.status(200).json(OrderData);
  } catch (err) {
    console.error("Error getting carts:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateCart = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { rental_date, rental_hour, return_date, quantity } = req.body;
  try {
    const regex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    //method test digunakan untuk mencocokkan isi dari kolom rental_hour agar sesuai pettern regex.
    if (!regex.test(rental_hour)) {
      return res
        .status(400)
        .json({ message: "Format jam sewa haru HH:mm, misal 11:30" });
    }

    const details = await OrderDetail.findById(id);

    if (!details) {
      return res.status(404).json({ message: "Item not found" });
    }

    const order = await Order.findUserCart(details.order_id, userId);
    if (!order) {
      return res.status(403).json({ message: "Item bukan milik anda" });
    }

    const rentalDateTime = new Date(`${rental_date}T${rental_hour}:00`);
    const returnDateTime = new Date(`${return_date}T${rental_hour}:00`);

    const durationMs = returnDateTime - rentalDateTime;
    if (durationMs <= 0) {
      return res.status(400).json({
        message: "Tanggal kembali harus setelah tanggal sewa",
      });
    }
    const orderDetail = order.details[0];
    const price = orderDetail.item.rental_price;

    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
    const itemSubtotal = price * quantity * durationDays;

    const dataToUpdateOrderDetail = {
      rental_date: new Date(rental_date),
      rental_hour: rental_hour,
      return_date: new Date(return_date),
      return_hour: rental_hour,
      quantity,
      status: "Keranjang",
      duration: durationDays,
      subtotal: itemSubtotal,
    };

    await OrderDetail.update(id, dataToUpdateOrderDetail);

    const totalSubtotal = OrderDetail.amountSubtotal(order.id);

    await Order.update(order.id, {
      subtotal: totalSubtotal._sum.subtotal || 0,
    });

    res.status(200).json({
      status: true,
      message: "Item successfully updated to cart",
    });
  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const checkoutSelectedItems = async (req, res) => {
  const userId = req.user.id;
  const { order_detail_ids } = req.body;

  if (!order_detail_ids || order_detail_ids.length === 0) {
    return res.status(400).json({
      message: "Pilih minimal 1 item untuk checkout",
    });
  }

  try {
    const cart = await Order.findCartByUserId(userId, order_detail_ids);
    if (!cart) {
      return res.status(404).json({
        message: "Cart not found",
      });
    }

    const details = await OrderDetail.findCartByOrderId(
      order_detail_ids,
      userId,
    );

    if (!details) {
      return res.status(404).json({
        message: "Details tidak ditemukan",
      });
    }

    for (const detail of details) {
      await Item.update(detail.item_id, {
        stock: { decrement: detail.quantity },
        status:
          detail.item.stock - detail.quantity === 0 ? "Disewa" : "Tersedia",
      });
    }

    const newOrder = await Order.create({
      user_id: userId,
      status: "Tertunda",
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

    const newCartSubtotal = await OrderDetail.amountCartSubtotal(cart.id);

    await Order.update(cart.id, {
      subtotal: newCartSubtotal._sum.subtotal || 0,
    });

    const totalSubtotal = OrderDetail.amountSubtotal(newOrder.id);

    await Order.update(newOrder.id, {
      subtotal: totalSubtotal._sum.subtotal || 0,
    });

    res.status(200).json({
      status: true,
      message: "Item successfully processed",
      data: {
        order_id: newOrder.id,
        subtotal: totalSubtotal._sum.subtotal || 0,
      },
    });
  } catch (error) {
    console.error("Checkout error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteCartItem = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const orderDetail = await OrderDetail.findById(id);

    if (!orderDetail) {
      return res.status(404).json({ message: "Item not found" });
    }

    const order = await Order.findUserCart(orderDetail.order_id, userId);
    if (!order) {
      return res.status(403).json({ message: "Item bukan milik anda" });
    }

    await OrderDetail.delete(id);

    const totalSubtotal = await OrderDetail.amountSubtotal(order.id);

    await Order.update(order.id, {
      subtotal: totalSubtotal._sum.subtotal || 0,
    });

    res
      .status(200)
      .json({ status: true, message: "Item successfully removed from cart" });
  } catch (error) {
    console.error("Error deleting cart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
