
-- Insert categories for a resto-bar
INSERT INTO public.categories (name, description) VALUES
  ('Entradas', 'Aperitivos y entradas para compartir'),
  ('Hamburguesas', 'Hamburguesas artesanales'),
  ('Pizzas', 'Pizzas al horno de leña'),
  ('Alitas', 'Alitas de pollo con diferentes salsas'),
  ('Papas & Snacks', 'Papas fritas, nachos y snacks'),
  ('Bebidas sin alcohol', 'Refrescos, jugos y aguas'),
  ('Licores', 'Whisky, ron, vodka y más'),
  ('Postres', 'Postres y dulces');

-- Insert products for each category using subqueries
-- Entradas
INSERT INTO public.products (name, description, price, stock_quantity, category, category_id) VALUES
  ('Nachos con Queso', 'Nachos crujientes con queso cheddar y jalapeños', 8.50, 50, 'Entradas', (SELECT id FROM categories WHERE name='Entradas')),
  ('Tequeños', '6 tequeños de queso con salsa de ajo', 6.00, 40, 'Entradas', (SELECT id FROM categories WHERE name='Entradas')),
  ('Aros de Cebolla', 'Aros de cebolla empanizados', 7.00, 35, 'Entradas', (SELECT id FROM categories WHERE name='Entradas'));

-- Hamburguesas
INSERT INTO public.products (name, description, price, stock_quantity, category, category_id) VALUES
  ('Hamburguesa Clásica', 'Carne 200g, lechuga, tomate, queso americano', 12.00, 30, 'Hamburguesas', (SELECT id FROM categories WHERE name='Hamburguesas')),
  ('Hamburguesa BBQ', 'Carne 200g, bacon, cebolla caramelizada, salsa BBQ', 14.00, 25, 'Hamburguesas', (SELECT id FROM categories WHERE name='Hamburguesas')),
  ('Hamburguesa Doble', 'Doble carne 400g, doble queso, pickles', 16.00, 20, 'Hamburguesas', (SELECT id FROM categories WHERE name='Hamburguesas'));

-- Pizzas
INSERT INTO public.products (name, description, price, stock_quantity, category, category_id) VALUES
  ('Pizza Margarita', 'Salsa de tomate, mozzarella y albahaca', 10.00, 20, 'Pizzas', (SELECT id FROM categories WHERE name='Pizzas')),
  ('Pizza Pepperoni', 'Pepperoni, mozzarella y orégano', 12.00, 20, 'Pizzas', (SELECT id FROM categories WHERE name='Pizzas')),
  ('Pizza BBQ Chicken', 'Pollo, salsa BBQ, cebolla morada, mozzarella', 14.00, 15, 'Pizzas', (SELECT id FROM categories WHERE name='Pizzas'));

-- Alitas
INSERT INTO public.products (name, description, price, stock_quantity, category, category_id) VALUES
  ('Alitas Buffalo (10 pzas)', 'Alitas picantes estilo Buffalo', 11.00, 30, 'Alitas', (SELECT id FROM categories WHERE name='Alitas')),
  ('Alitas BBQ (10 pzas)', 'Alitas bañadas en salsa BBQ', 11.00, 30, 'Alitas', (SELECT id FROM categories WHERE name='Alitas')),
  ('Alitas Miel Mostaza (10 pzas)', 'Alitas con glaseado de miel y mostaza', 11.00, 25, 'Alitas', (SELECT id FROM categories WHERE name='Alitas'));

-- Papas & Snacks
INSERT INTO public.products (name, description, price, stock_quantity, category, category_id) VALUES
  ('Papas Fritas', 'Porción grande de papas fritas', 5.00, 50, 'Papas & Snacks', (SELECT id FROM categories WHERE name='Papas & Snacks')),
  ('Papas con Queso y Bacon', 'Papas fritas con queso cheddar y bacon', 8.00, 35, 'Papas & Snacks', (SELECT id FROM categories WHERE name='Papas & Snacks'));

-- Cervezas (ya existe la categoría)
INSERT INTO public.products (name, description, price, stock_quantity, category, category_id) VALUES
  ('Corona', 'Cerveza Corona 355ml', 3.50, 100, 'Cervezas', (SELECT id FROM categories WHERE name='Cervezas')),
  ('Heineken', 'Cerveza Heineken 355ml', 4.00, 80, 'Cervezas', (SELECT id FROM categories WHERE name='Cervezas')),
  ('Cerveza Artesanal IPA', 'IPA artesanal local 500ml', 6.00, 40, 'Cervezas', (SELECT id FROM categories WHERE name='Cervezas'));

-- Cocteles (ya existe la categoría)
INSERT INTO public.products (name, description, price, stock_quantity, category, category_id) VALUES
  ('Mojito', 'Ron, hierbabuena, limón, azúcar y soda', 8.00, 30, 'Cocteles', (SELECT id FROM categories WHERE name='Cocteles')),
  ('Margarita', 'Tequila, triple sec y jugo de limón', 9.00, 30, 'Cocteles', (SELECT id FROM categories WHERE name='Cocteles')),
  ('Piña Colada', 'Ron, crema de coco y jugo de piña', 9.00, 25, 'Cocteles', (SELECT id FROM categories WHERE name='Cocteles'));

-- Bebidas sin alcohol
INSERT INTO public.products (name, description, price, stock_quantity, category, category_id) VALUES
  ('Coca-Cola', 'Coca-Cola 350ml', 2.50, 100, 'Bebidas sin alcohol', (SELECT id FROM categories WHERE name='Bebidas sin alcohol')),
  ('Limonada Natural', 'Limonada fresca con hierbabuena', 3.50, 50, 'Bebidas sin alcohol', (SELECT id FROM categories WHERE name='Bebidas sin alcohol')),
  ('Agua Mineral', 'Agua mineral 500ml', 2.00, 80, 'Bebidas sin alcohol', (SELECT id FROM categories WHERE name='Bebidas sin alcohol'));

-- Licores
INSERT INTO public.products (name, description, price, stock_quantity, category, category_id) VALUES
  ('Whisky Jack Daniels', 'Shot de Jack Daniels', 7.00, 40, 'Licores', (SELECT id FROM categories WHERE name='Licores')),
  ('Vodka Absolut', 'Shot de Absolut', 5.00, 50, 'Licores', (SELECT id FROM categories WHERE name='Licores')),
  ('Tequila José Cuervo', 'Shot de José Cuervo', 5.50, 45, 'Licores', (SELECT id FROM categories WHERE name='Licores'));

-- Postres
INSERT INTO public.products (name, description, price, stock_quantity, category, category_id) VALUES
  ('Brownie con Helado', 'Brownie de chocolate con helado de vainilla', 7.00, 20, 'Postres', (SELECT id FROM categories WHERE name='Postres')),
  ('Churros con Chocolate', '6 churros con salsa de chocolate', 6.00, 25, 'Postres', (SELECT id FROM categories WHERE name='Postres'));

-- 4 new tables (next numbers: 3, 4, 5, 6)
INSERT INTO public.tables (number, name, capacity) VALUES
  (3, 'Mesa 3', 4),
  (4, 'Mesa 4', 6),
  (5, 'Terraza 1', 4),
  (6, 'VIP', 8);
