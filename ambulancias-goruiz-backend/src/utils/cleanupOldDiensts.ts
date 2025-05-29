import Dienst from '../models/Dienst';

const cleanupOldDiensts = async () => {
  try {
    const today = new Date();
    const monday = new Date(today.setDate(today.getDate() - today.getDay() + 1));
    monday.setHours(0, 0, 0, 0);

    const result = await Dienst.deleteMany({ weekEndDate: { $lt: monday } });

    console.log(`🧹 Diensts antiguos eliminados automáticamente: ${result.deletedCount}`);
  } catch (error) {
    console.error('❌ Error al eliminar Diensts antiguos:', error);
  }
};

export default cleanupOldDiensts;

