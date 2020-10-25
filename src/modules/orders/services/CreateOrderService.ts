import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    // TODO
    const customerExist = await this.customersRepository.findById(customer_id);

    if (!customerExist) {
      throw new AppError('Customer not fould');
    }

    const productExist = await this.productsRepository.findAllById(products);

    if (!productExist.length) {
      throw new AppError('Products not fould');
    }

    const productExistIds = productExist.map(product => product.id);

    const checkInexistentProducts = products.filter(
      product => !productExistIds.includes(product.id),
    );

    if (checkInexistentProducts.length) {
      throw new AppError(
        `Could not find product ${checkInexistentProducts[0].id}`,
      );
    }

    const quantityNotAvailable = products.filter(
      product =>
        productExist.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (quantityNotAvailable.length) {
      throw new AppError(
        `Quantity ${quantityNotAvailable[0].quantity} not available to product ${quantityNotAvailable[0].id} `,
      );
    }

    const formattedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productExist.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExist,
      products: formattedProducts,
    });

    const { order_products } = order;

    const orderProductQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        productExist.filter(p => p.id === product.product_id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderProductQuantity);

    return order;
  }
}

export default CreateOrderService;
