import { View, Image, StyleSheet } from 'react-native';

export default function ProductViewer3D({ photoUri }) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Image
          source={{ uri: photoUri }}
          style={styles.image}
          resizeMode="contain"
        />
        <View style={styles.shadow} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    width: '100%',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  image: {
    width: '100%',
    height: '85%',
  },
  shadow: {
    position: 'absolute',
    bottom: 12,
    left: '15%',
    right: '15%',
    height: 16,
    backgroundColor: 'transparent',
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
});
