import prisma from "../databases/dbConfig.js";

class OrderDetail {
  static async create(orderDetailData) {
    return prisma.orderDetail.create({
      data: orderDetailData,
    });
  }

  static async findById(id) {
    return await prisma.orderDetail.findUnique({
      where: { id: parseInt(id) },
    });
  }

  static async findCartByOrderId(id, userId) {
    return await prisma.orderDetail.findMany({
      where: {
        id: { in: id },
        order: {
          user_id: userId,
          status: "Keranjang",
        },
      },
      include: {
        item: true,
      },
    });
  }

  static async findRentedByOrderId(id, userId) {
    return await prisma.orderDetail.findMany({
      where: {
        id: { in: id },
        order: {
          user_id: userId,
          status: "Disewa",
        },
      },
      include: {
        item: true,
      },
    });
  }

  static async amountCartSubtotal(order_id) {
    return prisma.orderDetail.aggregate({
      _sum: { subtotal: true },
      where: { order_id: order_id, status: "Keranjang" },
    });
  }

  static async amountRentedSubtotal(order_id) {
    return prisma.orderDetail.aggregate({
      _sum: { subtotal: true },
      where: { order_id: order_id, status: "Disewa" },
    });
  }

  static async amountSubtotal(order_id) {
    return prisma.orderDetail.aggregate({
      _sum: { subtotal: true },
      where: { order_id: order_id },
    });
  }

  static async update(id, orderDetailData) {
    try {
      return await prisma.orderDetail.update({
        where: { id: parseInt(id) },
        data: orderDetailData,
      });
    } catch (error) {
      if (error.code === "P2025") {
        return null;
      }
      throw error;
    }
  }

  static async moveOrderDetailsToOrder(orderDetailIds, newOrderId) {
    return prisma.orderDetail.updateMany({
      where: {
        id: { in: orderDetailIds },
        status: "Disewa",
      },
      data: {
        order_id: newOrderId,
        status: "Selesai",
      },
    });
  }

  static async numberOfDetail(orderId) {
    return prisma.orderDetail.count({
      where: { order_id: orderId },
    });
  }

  static async delete(id) {
    try {
      return await prisma.orderDetail.delete({
        where: { id: parseInt(id) },
      });
    } catch (error) {
      if (error.code === "P2025") {
        return null;
      }
      throw error;
    }
  }
}

export default OrderDetail;
