import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'mysetup_items';

export async function getSetupItems() {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function addSetupItem(product, cleanPhotoBase64) {
  const items = await getSetupItems();
  const newItem = {
    id: Date.now().toString(),
    product,
    photoBase64: cleanPhotoBase64,
    addedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(KEY, JSON.stringify([newItem, ...items]));
  return newItem;
}

export async function removeSetupItem(id) {
  const items = await getSetupItems();
  await AsyncStorage.setItem(KEY, JSON.stringify(items.filter(i => i.id !== id)));
}
