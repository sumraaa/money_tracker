import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  NAME: '@pace_user_name',
  PHONE: '@pace_user_phone',
  IS_LOGGED_IN: '@pace_is_logged_in',
};

/**
 * Log in user by storing name and phone in AsyncStorage.
 * @param {string} name 
 * @param {string} phone 
 */
export async function login(name, phone) {
  try {
    const trimmedName = (name || '').trim();
    const trimmedPhone = (phone || '').trim();

    if (!trimmedName) {
      throw new Error('Please enter your name.');
    }

    const cleanPhone = trimmedPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      throw new Error('Please enter a valid phone number (at least 10 digits).');
    }

    await AsyncStorage.multiSet([
      [KEYS.NAME, trimmedName],
      [KEYS.PHONE, trimmedPhone],
      [KEYS.IS_LOGGED_IN, 'true'],
    ]);

    return { success: true, name: trimmedName, phone: trimmedPhone };
  } catch (error) {
    console.error('[AuthService] Login error:', error);
    throw error;
  }
}

/**
 * Retrieves the current logged in user session details.
 * Defaults: { name: 'User', phone: '', isLoggedIn: false }
 */
export async function getUser() {
  try {
    const values = await AsyncStorage.multiGet([
      KEYS.NAME,
      KEYS.PHONE,
      KEYS.IS_LOGGED_IN,
    ]);

    const nameVal = values[0][1];
    const phoneVal = values[1][1];
    const loggedInVal = values[2][1];

    const isLoggedIn = loggedInVal === 'true';

    return {
      name: nameVal && nameVal.trim() !== '' ? nameVal.trim() : 'User',
      phone: phoneVal || '',
      isLoggedIn: isLoggedIn,
    };
  } catch (error) {
    console.error('[AuthService] getUser error:', error);
    return { name: 'User', phone: '', isLoggedIn: false };
  }
}

/**
 * Logs out the user by removing all session keys.
 */
export async function logout() {
  try {
    await AsyncStorage.multiRemove([
      KEYS.NAME,
      KEYS.PHONE,
      KEYS.IS_LOGGED_IN,
    ]);
    return { success: true };
  } catch (error) {
    console.error('[AuthService] Logout error:', error);
    throw error;
  }
}

export default {
  login,
  getUser,
  logout,
};
