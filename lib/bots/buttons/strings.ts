/**
 * Bot ichidagi tizim matnlari va DIZAYN TIZIMI (uz/ru/en).
 *
 * Bular konstruktorda sozlanmaydigan matnlar: navigatsiya, savatcha,
 * buyurtmalar, profil, yordam va xato javoblari. Foydalanuvchi (bot egasi)
 * yozgan matnlar `actionConfig` da qoladi — bu yerda faqat botning o'zi
 * aytadigan gaplar turadi.
 *
 * DIZAYN TIZIMI — butun bot bo'ylab bitta uslub:
 *
 *   PRIMARY     🛍 ✅ ➕      asosiy amal
 *   NAVIGATION  ⬅️ 🏠         ekranlar orasida yurish
 *   DANGER      🗑 ❌         o'chirish, bekor qilish
 *   STATUS      🟢 🟡 🔵 🔴   holat belgilari
 *
 * Har bir emoji shu to'rt guruhdan biriga tegishli bo'lishi kerak: bir xil
 * ma'no doim bir xil belgi bilan chiqadi, shuning uchun foydalanuvchi ikkinchi
 * ekrandan boshlab tugmani o'qimasdan ham taniydi.
 *
 * Til Telegram'dagi `language_code` dan olinadi; nomos til uchun — o'zbekcha.
 */

export type BotStringKey =
  /* Navigatsiya */
  | "back"
  | "home"
  | "mainMenu"
  | "menuHint"
  | "welcome"
  /* Bo'sh va tushunarsiz holatlar */
  | "emptyMenu"
  | "emptyMenuHint"
  | "notConfigured"
  | "notUnderstood"
  | "browseProducts"
  /* Xatolar */
  | "menuGone"
  | "staleButton"
  | "notAllowed"
  | "somethingWrong"
  /* Mahsulot */
  | "price"
  | "inStock"
  | "outOfStock"
  | "addToCart"
  | "buyNow"
  | "viewPhoto"
  | "inCart"
  /* Savatcha */
  | "cartTitle"
  | "cartEmpty"
  | "cartEmptyHint"
  | "cartTotal"
  | "cartCount"
  | "checkout"
  | "clearCart"
  | "addMore"
  | "webAppReceived"
  | "addedToCart"
  | "cartFull"
  | "cartCleared"
  | "removedFromCart"
  | "orderPlaced"
  | "orderEmpty"
  | "menuClosed"
  /* Buyurtmalar */
  | "ordersTitle"
  | "ordersEmpty"
  | "ordersEmptyHint"
  | "ordersHint"
  | "orderTitle"
  | "orderStatus"
  | "orderDate"
  | "orderTotal"
  | "orderItems"
  | "orderGone"
  | "statusPending"
  | "statusProcessing"
  | "statusShipping"
  | "statusDone"
  | "statusCancelled"
  /* Sevimlilar */
  | "favoritesTitle"
  | "favoritesEmpty"
  | "favoritesEmptyHint"
  | "favoritesHint"
  | "favoriteAdd"
  | "favoriteRemove"
  | "favoriteAdded"
  | "favoriteRemoved"
  | "favoritesClear"
  | "favoritesCleared"
  /* Profil */
  | "profileTitle"
  | "profileName"
  | "profilePhone"
  | "profileEmail"
  | "profileLanguage"
  | "profileEmpty"
  | "myOrders"
  | "myFavorites"
  | "settings"
  | "settingsTitle"
  | "settingsHint"
  | "changeLanguage"
  | "changeName"
  | "sharePhone"
  | "shareLocation"
  | "askName"
  | "askEmail"
  | "askPhone"
  | "askLocation"
  | "invalidEmail"
  | "saved"
  /* Yordam */
  | "helpTitle"
  | "helpBody";

type Table = Record<BotStringKey, string>;

const uz: Table = {
  back: "⬅️ Ortga",
  home: "🏠 Bosh menyu",
  mainMenu: "🏠 Bosh menyu",
  menuHint: "Kerakli bo'limni tanlang 👇",
  welcome:
    "👋 Assalomu alaykum!\n\n" +
    "Bot orqali kerakli xizmatlarni tez va qulay boshqarishingiz mumkin.\n\n" +
    "Quyidagi menyudan kerakli bo'limni tanlang 👇",

  emptyMenu: "Bu bo'lim hozircha bo'sh.",
  emptyMenuHint: "Tez orada to'ldiramiz. Boshqa bo'limlarni ko'rib chiqing 👇",
  notConfigured: "🔧 Bot hozircha sozlanmagan.\n\nEgasi menyuni tayyorlagach shu yerda bo'limlar paydo bo'ladi.",
  notUnderstood: "🤔 Tushunmadim.\n\nQuyidagi menyudan kerakli bo'limni tanlang 👇",
  browseProducts: "🛍 Mahsulotlarni ko'rish",

  menuGone: "😕 Bu bo'lim endi mavjud emas.\n\nBosh menyudan qaytadan boshlang.",
  staleButton: "😕 Bu tugma eskirgan.\n\nBosh menyudan qaytadan boshlang.",
  notAllowed: "Bu amal siz uchun mavjud emas",
  somethingWrong: "😕 Nimadir xato ketdi.\n\nIltimos, qaytadan urinib ko'ring.",

  price: "💰 Narxi",
  inStock: "🟢 Mavjud",
  outOfStock: "🔴 Omborda yo'q",
  addToCart: "🛒 Savatchaga qo'shish",
  buyNow: "⚡️ Hozir sotib olish",
  viewPhoto: "🖼 Rasmni ko'rish",
  inCart: "🛒 Savatchada: {qty} ta",

  cartTitle: "🛒 Savatchangiz",
  cartEmpty: "🛒 Savatchangiz hozircha bo'sh.",
  cartEmptyHint: "Mahsulotlarni ko'rib chiqing va yoqqanlarini savatchaga qo'shing 👇",
  cartTotal: "Jami",
  cartCount: "{count} ta mahsulot",
  checkout: "✅ Buyurtma berish",
  clearCart: "🗑 Tozalash",
  addMore: "➕ Mahsulot qo'shish",
  webAppReceived: "✅ Ma'lumot qabul qilindi.",
  addedToCart: "✅ Savatchaga qo'shildi",
  cartFull: "Savatcha to'ldi — avval buyurtma bering yoki biror mahsulotni oling",
  cartCleared: "🗑 Savatcha tozalandi",
  removedFromCart: "🗑 Savatchadan olindi",
  orderPlaced: "✅ Buyurtmangiz qabul qilindi!\n\nRaqami: {order}\nSummasi: {total}\n\nTez orada siz bilan bog'lanamiz.",
  orderEmpty: "Savatcha bo'sh — avval mahsulot tanlang.",
  menuClosed: "Menyu yopildi. Qaytish uchun /start yuboring.",

  ordersTitle: "📦 Buyurtmalarim",
  ordersEmpty: "📦 Sizda hali buyurtma yo'q.",
  ordersEmptyHint: "Mahsulot tanlang va birinchi buyurtmangizni bering 👇",
  ordersHint: "Batafsil ko'rish uchun buyurtmani tanlang 👇",
  orderTitle: "📦 Buyurtma {order}",
  orderStatus: "Holati",
  orderDate: "Sana",
  orderTotal: "Jami",
  orderItems: "Mahsulotlar",
  orderGone: "😕 Bu buyurtma topilmadi.",
  statusPending: "🟡 Kutilmoqda",
  statusProcessing: "🔵 Tayyorlanmoqda",
  statusShipping: "🚚 Yetkazilmoqda",
  statusDone: "🟢 Yetkazildi",
  statusCancelled: "🔴 Bekor qilingan",

  favoritesTitle: "❤️ Sevimlilar",
  favoritesEmpty: "❤️ Sevimlilar ro'yxati bo'sh.",
  favoritesEmptyHint: "Mahsulot kartasidagi ❤️ tugmasi bilan yoqqanlarini saqlab qo'ying 👇",
  favoritesHint: "Ochish uchun mahsulotni tanlang 👇",
  favoriteAdd: "❤️ Sevimlilarga",
  favoriteRemove: "💔 Sevimlilardan olish",
  favoriteAdded: "❤️ Sevimlilarga qo'shildi",
  favoriteRemoved: "💔 Sevimlilardan olindi",
  favoritesClear: "🗑 Tozalash",
  favoritesCleared: "🗑 Sevimlilar tozalandi",

  profileTitle: "👤 Profil",
  profileName: "Ism",
  profilePhone: "Telefon",
  profileEmail: "Email",
  profileLanguage: "Til",
  profileEmpty: "ko'rsatilmagan",
  myOrders: "📦 Buyurtmalarim",
  myFavorites: "❤️ Sevimlilar",
  settings: "⚙️ Sozlamalar",
  settingsTitle: "⚙️ Sozlamalar",
  settingsHint: "Ma'lumotlaringizni shu yerdan o'zgartirasiz 👇",
  changeLanguage: "🌐 Tilni o'zgartirish",
  changeName: "✏️ Ismni o'zgartirish",
  sharePhone: "📱 Telefonni yuborish",
  shareLocation: "📍 Joylashuvni yuborish",
  askName: "Ismingizni yozing:",
  askEmail: "Email manzilingizni yozing:",
  askPhone: "Telefon raqamingizni yuborish uchun tugmani bosing 👇",
  askLocation: "Joylashuvingizni yuborish uchun tugmani bosing 👇",
  invalidEmail: "😕 Email manzil noto'g'ri. Qaytadan kiriting:",
  saved: "✅ Saqlandi, rahmat!",

  helpTitle: "ℹ️ Yordam",
  helpBody:
    "Bot quyidagicha ishlaydi:\n\n" +
    "🛍 Mahsulotlar — katalogni kategoriyalar bo'yicha ko'rish\n" +
    "🛒 Savatcha — tanlaganlaringiz va buyurtma berish\n" +
    "📦 Buyurtmalarim — buyurtma holatini kuzatish\n" +
    "❤️ Sevimlilar — yoqqan mahsulotlaringiz\n" +
    "👤 Profil — ma'lumotlaringiz va sozlamalar\n\n" +
    "⬅️ Ortga — bir qadam orqaga\n" +
    "🏠 Bosh menyu — boshiga qaytish",
};

const ru: Table = {
  back: "⬅️ Назад",
  home: "🏠 Главное меню",
  mainMenu: "🏠 Главное меню",
  menuHint: "Выберите нужный раздел 👇",
  welcome:
    "👋 Здравствуйте!\n\n" +
    "Через бота вы быстро и удобно получите нужные услуги.\n\n" +
    "Выберите раздел в меню ниже 👇",

  emptyMenu: "Этот раздел пока пуст.",
  emptyMenuHint: "Скоро наполним. Посмотрите другие разделы 👇",
  notConfigured: "🔧 Бот пока не настроен.\n\nКогда владелец подготовит меню, разделы появятся здесь.",
  notUnderstood: "🤔 Не понял.\n\nВыберите нужный раздел в меню ниже 👇",
  browseProducts: "🛍 Смотреть товары",

  menuGone: "😕 Этого раздела больше нет.\n\nНачните с главного меню.",
  staleButton: "😕 Кнопка устарела.\n\nНачните с главного меню.",
  notAllowed: "Это действие вам недоступно",
  somethingWrong: "😕 Что-то пошло не так.\n\nПожалуйста, попробуйте снова.",

  price: "💰 Цена",
  inStock: "🟢 В наличии",
  outOfStock: "🔴 Нет в наличии",
  addToCart: "🛒 В корзину",
  buyNow: "⚡️ Купить сейчас",
  viewPhoto: "🖼 Посмотреть фото",
  inCart: "🛒 В корзине: {qty} шт",

  cartTitle: "🛒 Ваша корзина",
  cartEmpty: "🛒 Ваша корзина пока пуста.",
  cartEmptyHint: "Посмотрите товары и добавьте понравившиеся в корзину 👇",
  cartTotal: "Итого",
  cartCount: "{count} товара",
  checkout: "✅ Оформить заказ",
  clearCart: "🗑 Очистить",
  addMore: "➕ Добавить товар",
  webAppReceived: "✅ Данные получены.",
  addedToCart: "✅ Добавлено в корзину",
  cartFull: "Корзина заполнена — оформите заказ или уберите один товар",
  cartCleared: "🗑 Корзина очищена",
  removedFromCart: "🗑 Убрано из корзины",
  orderPlaced: "✅ Заказ принят!\n\nНомер: {order}\nСумма: {total}\n\nМы скоро свяжемся с вами.",
  orderEmpty: "Корзина пуста — сначала выберите товар.",
  menuClosed: "Меню закрыто. Чтобы вернуться, отправьте /start.",

  ordersTitle: "📦 Мои заказы",
  ordersEmpty: "📦 У вас пока нет заказов.",
  ordersEmptyHint: "Выберите товар и сделайте первый заказ 👇",
  ordersHint: "Выберите заказ, чтобы посмотреть подробности 👇",
  orderTitle: "📦 Заказ {order}",
  orderStatus: "Статус",
  orderDate: "Дата",
  orderTotal: "Итого",
  orderItems: "Товары",
  orderGone: "😕 Такой заказ не найден.",
  statusPending: "🟡 Ожидает",
  statusProcessing: "🔵 Готовится",
  statusShipping: "🚚 В доставке",
  statusDone: "🟢 Доставлен",
  statusCancelled: "🔴 Отменён",

  favoritesTitle: "❤️ Избранное",
  favoritesEmpty: "❤️ Список избранного пуст.",
  favoritesEmptyHint: "Сохраняйте понравившиеся товары кнопкой ❤️ в карточке 👇",
  favoritesHint: "Выберите товар, чтобы открыть 👇",
  favoriteAdd: "❤️ В избранное",
  favoriteRemove: "💔 Убрать из избранного",
  favoriteAdded: "❤️ Добавлено в избранное",
  favoriteRemoved: "💔 Убрано из избранного",
  favoritesClear: "🗑 Очистить",
  favoritesCleared: "🗑 Избранное очищено",

  profileTitle: "👤 Профиль",
  profileName: "Имя",
  profilePhone: "Телефон",
  profileEmail: "Email",
  profileLanguage: "Язык",
  profileEmpty: "не указано",
  myOrders: "📦 Мои заказы",
  myFavorites: "❤️ Избранное",
  settings: "⚙️ Настройки",
  settingsTitle: "⚙️ Настройки",
  settingsHint: "Здесь можно изменить ваши данные 👇",
  changeLanguage: "🌐 Сменить язык",
  changeName: "✏️ Изменить имя",
  sharePhone: "📱 Отправить телефон",
  shareLocation: "📍 Отправить геолокацию",
  askName: "Напишите ваше имя:",
  askEmail: "Напишите ваш email:",
  askPhone: "Нажмите кнопку, чтобы отправить номер 👇",
  askLocation: "Нажмите кнопку, чтобы отправить геолокацию 👇",
  invalidEmail: "😕 Неверный email. Введите ещё раз:",
  saved: "✅ Сохранено, спасибо!",

  helpTitle: "ℹ️ Помощь",
  helpBody:
    "Как работает бот:\n\n" +
    "🛍 Товары — каталог по категориям\n" +
    "🛒 Корзина — выбранное и оформление заказа\n" +
    "📦 Мои заказы — статус ваших заказов\n" +
    "❤️ Избранное — понравившиеся товары\n" +
    "👤 Профиль — ваши данные и настройки\n\n" +
    "⬅️ Назад — на шаг назад\n" +
    "🏠 Главное меню — вернуться в начало",
};

const en: Table = {
  back: "⬅️ Back",
  home: "🏠 Main menu",
  mainMenu: "🏠 Main menu",
  menuHint: "Pick a section below 👇",
  welcome:
    "👋 Hello!\n\n" +
    "This bot gets you what you need in a couple of taps.\n\n" +
    "Pick a section from the menu below 👇",

  emptyMenu: "This section is empty for now.",
  emptyMenuHint: "We'll fill it soon. Have a look at the other sections 👇",
  notConfigured: "🔧 This bot isn't set up yet.\n\nSections will appear here once the owner builds the menu.",
  notUnderstood: "🤔 I didn't get that.\n\nPick a section from the menu below 👇",
  browseProducts: "🛍 Browse products",

  menuGone: "😕 This section no longer exists.\n\nStart from the main menu.",
  staleButton: "😕 This button is out of date.\n\nStart from the main menu.",
  notAllowed: "This action is not available to you",
  somethingWrong: "😕 Something went wrong.\n\nPlease try again.",

  price: "💰 Price",
  inStock: "🟢 In stock",
  outOfStock: "🔴 Out of stock",
  addToCart: "🛒 Add to cart",
  buyNow: "⚡️ Buy now",
  viewPhoto: "🖼 View photo",
  inCart: "🛒 In cart: {qty}",

  cartTitle: "🛒 Your cart",
  cartEmpty: "🛒 Your cart is empty for now.",
  cartEmptyHint: "Browse the products and add the ones you like 👇",
  cartTotal: "Total",
  cartCount: "{count} items",
  checkout: "✅ Place order",
  clearCart: "🗑 Clear",
  addMore: "➕ Add product",
  webAppReceived: "✅ Data received.",
  addedToCart: "✅ Added to cart",
  cartFull: "The cart is full — place the order or remove an item first",
  cartCleared: "🗑 Cart cleared",
  removedFromCart: "🗑 Removed from cart",
  orderPlaced: "✅ Your order is confirmed!\n\nNumber: {order}\nTotal: {total}\n\nWe'll get in touch shortly.",
  orderEmpty: "The cart is empty — pick a product first.",
  menuClosed: "Menu closed. Send /start to come back.",

  ordersTitle: "📦 My orders",
  ordersEmpty: "📦 You have no orders yet.",
  ordersEmptyHint: "Pick a product and place your first order 👇",
  ordersHint: "Choose an order to see the details 👇",
  orderTitle: "📦 Order {order}",
  orderStatus: "Status",
  orderDate: "Date",
  orderTotal: "Total",
  orderItems: "Items",
  orderGone: "😕 That order was not found.",
  statusPending: "🟡 Pending",
  statusProcessing: "🔵 Preparing",
  statusShipping: "🚚 On the way",
  statusDone: "🟢 Delivered",
  statusCancelled: "🔴 Cancelled",

  favoritesTitle: "❤️ Favorites",
  favoritesEmpty: "❤️ Your favorites list is empty.",
  favoritesEmptyHint: "Save what you like with the ❤️ button on a product card 👇",
  favoritesHint: "Choose a product to open it 👇",
  favoriteAdd: "❤️ Add to favorites",
  favoriteRemove: "💔 Remove from favorites",
  favoriteAdded: "❤️ Added to favorites",
  favoriteRemoved: "💔 Removed from favorites",
  favoritesClear: "🗑 Clear",
  favoritesCleared: "🗑 Favorites cleared",

  profileTitle: "👤 Profile",
  profileName: "Name",
  profilePhone: "Phone",
  profileEmail: "Email",
  profileLanguage: "Language",
  profileEmpty: "not set",
  myOrders: "📦 My orders",
  myFavorites: "❤️ Favorites",
  settings: "⚙️ Settings",
  settingsTitle: "⚙️ Settings",
  settingsHint: "Change your details here 👇",
  changeLanguage: "🌐 Change language",
  changeName: "✏️ Change name",
  sharePhone: "📱 Share phone",
  shareLocation: "📍 Share location",
  askName: "Type your name:",
  askEmail: "Type your email:",
  askPhone: "Tap the button to share your number 👇",
  askLocation: "Tap the button to share your location 👇",
  invalidEmail: "😕 That email looks wrong. Try again:",
  saved: "✅ Saved, thank you!",

  helpTitle: "ℹ️ Help",
  helpBody:
    "How this bot works:\n\n" +
    "🛍 Products — browse the catalog by category\n" +
    "🛒 Cart — what you picked and checkout\n" +
    "📦 My orders — track your orders\n" +
    "❤️ Favorites — products you liked\n" +
    "👤 Profile — your details and settings\n\n" +
    "⬅️ Back — one step back\n" +
    "🏠 Main menu — return to the start",
};

const TABLES: Record<string, Table> = { uz, ru, en };

/** Til kodiga mos matn. `{name}` o'rin egallovchilari to'ldiriladi. */
export function botText(
  lang: string | null | undefined,
  key: BotStringKey,
  values?: Record<string, string | number>,
): string {
  const table = TABLES[lang?.slice(0, 2) ?? "uz"] ?? uz;
  const template = table[key];
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

/**
 * Bir xil kalitning uch tildagi barcha qiymatlari.
 *
 * Reply klaviaturasidagi tugma Telegram'dan oddiy matn bo'lib qaytadi, ya'ni
 * uni yorlig'i bo'yicha tanish kerak. Foydalanuvchi tilini almashtirgan
 * bo'lsa chatda eski tildagi klaviatura qolib ketadi — shuning uchun
 * taqqoslash uchtasi bo'yicha ham qilinadi.
 */
export function botTextVariants(key: BotStringKey): string[] {
  return Object.values(TABLES).map((table) => table[key]);
}
