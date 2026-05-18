import { prisma } from "@/lib/prisma";

export async function getPaymentReceiptData(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: {
      id: paymentId
    },
    include: {
      customer: {
        select: {
          id: true,
          customerType: true,
          displayName: true,
          companyName: true,
          contactPersonName: true,
          contacts: {
            orderBy: [
              {
                isPrimary: "desc"
              },
              {
                createdAt: "asc"
              }
            ],
            take: 3,
            select: {
              type: true,
              label: true,
              value: true,
              isPrimary: true
            }
          },
          addresses: {
            orderBy: [
              {
                isDefault: "desc"
              },
              {
                createdAt: "asc"
              }
            ],
            take: 2,
            select: {
              label: true,
              recipientName: true,
              phone: true,
              addressLine: true,
              city: true,
              province: true,
              postalCode: true,
              isDefault: true
            }
          }
        }
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          confirmedAt: true,
          createdAt: true,
          currency: true,
          totalAmount: true,
          paidAmount: true,
          balanceAmount: true,
          customerNotes: true,
          payments: {
            where: {
              status: "RECORDED"
            },
            orderBy: [
              {
                paymentDate: "asc"
              },
              {
                createdAt: "asc"
              }
            ],
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              createdAt: true
            }
          }
        }
      },
      receivedBy: {
        select: {
          displayName: true,
          email: true
        }
      },
      documents: {
        where: {
          documentType: "PAYMENT_RECEIPT"
        },
        orderBy: {
          createdAt: "desc"
        },
        select: {
          id: true,
          documentType: true,
          title: true,
          generatedAt: true,
          generatedBy: {
            select: {
              displayName: true
            }
          },
          cloudinaryPublicId: true,
          secureUrl: true
        }
      }
    }
  });

  if (!payment) {
    return null;
  }

  let paidBeforeThisPayment = 0;

  for (const orderPayment of payment.order.payments) {
    if (orderPayment.id === payment.id) {
      break;
    }

    paidBeforeThisPayment += Number(orderPayment.amount);
  }

  const paidAfterThisPayment = paidBeforeThisPayment + Number(payment.amount);
  const balanceAfterThisPayment = Math.max(Number(payment.order.totalAmount) - paidAfterThisPayment, 0);

  return {
    company: {
      displayName: "Furniture Odyssey"
    },
    customer: payment.customer,
    order: {
      id: payment.order.id,
      orderNumber: payment.order.orderNumber,
      orderDate: payment.order.confirmedAt ?? payment.order.createdAt,
      totalAmount: Number(payment.order.totalAmount),
      paidAmountBeforePayment: paidBeforeThisPayment,
      paidAmountAfterPayment: paidAfterThisPayment,
      currentPaidAmount: Number(payment.order.paidAmount),
      balanceAfterPayment: balanceAfterThisPayment,
      currentBalanceAmount: Number(payment.order.balanceAmount),
      currency: payment.order.currency,
      customerNotes: payment.order.customerNotes
    },
    payment: {
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      paymentType: payment.paymentType,
      paymentDate: payment.paymentDate,
      amount: Number(payment.amount),
      method: payment.method,
      referenceNumber: payment.referenceNumber,
      payerName: payment.payerName,
      receivedBy: payment.receivedBy,
      customerNotes: payment.customerNotes
    },
    documents: payment.documents
  };
}
