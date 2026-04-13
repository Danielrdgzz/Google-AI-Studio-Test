import { useState, useEffect } from 'react';
import { 
  auth, db, handleFirestoreError, OperationType 
} from './firebase';
import { 
  signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User 
} from 'firebase/auth';
import { 
  collection, addDoc, query, where, onSnapshot, getDocs, doc, setDoc 
} from 'firebase/firestore';
import { UserProfile, Session, Workshop } from './types';
import { Plus, LogOut, Clock, Calendar, Users, BookOpen, LayoutDashboard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInMinutes, parse } from 'date-fns';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddSession, setShowAddSession] = useState(false);
  const [showAddWorkshop, setShowAddWorkshop] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Form state
  const [newSession, setNewSession] = useState({
    beneficiaryId: '',
    activity: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '10:00'
  });

  const [newWorkshop, setNewWorkshop] = useState({
    title: '',
    type: '',
    beneficiaryIds: [] as string[],
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDoc = doc(db, 'users', firebaseUser.uid);
        try {
          const snap = await getDocs(query(collection(db, 'users'), where('uid', '==', firebaseUser.uid)));
          if (snap.empty) {
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Usuario',
              email: firebaseUser.email || '',
              role: 'professional',
              createdAt: new Date().toISOString()
            };
            await setDoc(userDoc, newProfile);
            setProfile(newProfile);
          } else {
            setProfile(snap.docs[0].data() as UserProfile);
          }
        } catch (e) {
          console.error("Error fetching profile", e);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !profile) return;

    const qSessions = profile.role === 'admin' 
      ? collection(db, 'sessions')
      : query(collection(db, 'sessions'), where('professionalId', '==', user.uid));
    
    const unsubSessions = onSnapshot(qSessions, (snap) => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Session)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sessions'));

    const unsubWorkshops = onSnapshot(collection(db, 'workshops'), (snap) => {
      setWorkshops(snap.docs.map(d => ({ id: d.id, ...d.data() } as Workshop)));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map(d => d.data() as UserProfile));
    });

    return () => {
      unsubSessions();
      unsubWorkshops();
      unsubUsers();
    };
  }, [user, profile]);

  const handleLogin = async () => {
    setLoginError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e: any) {
      console.error("Login failed", e);
      if (e.code === 'auth/popup-closed-by-user') {
        setLoginError("El inicio de sesión fue cancelado. Por favor, inténtalo de nuevo.");
      } else if (e.code === 'auth/popup-blocked') {
        setLoginError("El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio.");
      } else {
        setLoginError("Ocurrió un error al iniciar sesión. Por favor, intenta de nuevo.");
      }
    }
  };

  const handleAddSession = async (e: any) => {
    e.preventDefault();
    if (!user) return;

    const start = parse(newSession.startTime, 'HH:mm', new Date());
    const end = parse(newSession.endTime, 'HH:mm', new Date());
    const duration = differenceInMinutes(end, start);

    try {
      await addDoc(collection(db, 'sessions'), {
        professionalId: user.uid,
        beneficiaryId: newSession.beneficiaryId,
        activity: newSession.activity,
        date: newSession.date,
        startTime: newSession.startTime,
        endTime: newSession.endTime,
        durationMinutes: duration,
        createdAt: new Date().toISOString()
      });
      setShowAddSession(false);
      setNewSession({ ...newSession, activity: '', beneficiaryId: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'sessions');
    }
  };

  const handleAddWorkshop = async (e: any) => {
    e.preventDefault();
    if (!user) return;

    try {
      await addDoc(collection(db, 'workshops'), {
        professionalId: user.uid,
        title: newWorkshop.title,
        type: newWorkshop.type,
        beneficiaryIds: newWorkshop.beneficiaryIds,
        date: newWorkshop.date,
        createdAt: new Date().toISOString()
      });
      setShowAddWorkshop(false);
      setNewWorkshop({ title: '', type: '', beneficiaryIds: [], date: format(new Date(), 'yyyy-MM-dd') });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'workshops');
    }
  };

  const seedExampleData = async () => {
    if (!user) return;
    try {
      // Add some beneficiaries if they don't exist
      const beneficiaries = [
        { uid: 'b1', name: 'Juan Pérez', role: 'beneficiary', email: 'juan@example.com' },
        { uid: 'b2', name: 'María García', role: 'beneficiary', email: 'maria@example.com' },
        { uid: 'b3', name: 'Carlos López', role: 'beneficiary', email: 'carlos@example.com' }
      ];

      for (const b of beneficiaries) {
        await setDoc(doc(db, 'users', b.uid), { ...b, createdAt: new Date().toISOString() });
      }

      // Add example sessions
      const exampleSessions = [
        { professionalId: user.uid, beneficiaryId: 'b1', activity: 'Fisioterapia Motora', date: '2024-04-10', startTime: '10:00', endTime: '11:00', durationMinutes: 60 },
        { professionalId: user.uid, beneficiaryId: 'b2', activity: 'Terapia Ocupacional', date: '2024-04-11', startTime: '11:30', endTime: '12:30', durationMinutes: 60 },
        { professionalId: user.uid, beneficiaryId: 'b3', activity: 'Apoyo Psicológico', date: '2024-04-12', startTime: '09:00', endTime: '10:00', durationMinutes: 60 }
      ];

      for (const s of exampleSessions) {
        await addDoc(collection(db, 'sessions'), { ...s, createdAt: new Date().toISOString() });
      }

      // Add example workshops
      const exampleWorkshops = [
        { title: 'Taller de Pintura Adaptada', type: 'Creativo', professionalId: user.uid, beneficiaryIds: ['b1', 'b2'], date: '2024-04-15' },
        { title: 'Iniciación a la Informática', type: 'Educativo', professionalId: user.uid, beneficiaryIds: ['b2', 'b3'], date: '2024-04-16' }
      ];

      for (const w of exampleWorkshops) {
        await addDoc(collection(db, 'workshops'), { ...w, createdAt: new Date().toISOString() });
      }

      alert("Datos de ejemplo cargados con éxito");
    } catch (err) {
      console.error("Error seeding data", err);
    }
  };

  const totalHoursImparted = (sessions.reduce((acc, s) => acc + s.durationMinutes, 0) / 60).toFixed(1);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center"
      >
        <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
          <LayoutDashboard className="text-blue-600 w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Panel de Coordinación</h1>
        <p className="text-slate-600 mb-8">Accede para gestionar tus sesiones, talleres y horas impartidas.</p>
        
        {loginError && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl"
          >
            {loginError}
          </motion.div>
        )}

        <button 
          onClick={handleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
        >
          Iniciar Sesión con Google
        </button>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <LayoutDashboard className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-slate-900 text-lg hidden sm:block">CoordinApp</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={seedExampleData}
              className="hidden sm:flex items-center gap-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3 h-3" /> Cargar Ejemplos
            </button>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-900">{profile?.name}</p>
              <p className="text-xs text-slate-500 capitalize">
                {profile?.role === 'professional' ? 'Profesional' : 
                 profile?.role === 'beneficiary' ? 'Beneficiario' : 
                 profile?.role === 'admin' ? 'Administrador' : profile?.role}
              </p>
            </div>
            <button 
              onClick={() => auth.signOut()}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div whileHover={{ y: -2 }} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-xl">
                <Clock className="text-blue-600 w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Horas Totales</p>
                <p className="text-2xl font-bold text-slate-900">{totalHoursImparted}h</p>
              </div>
            </div>
          </motion.div>
          <motion.div whileHover={{ y: -2 }} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-100 p-3 rounded-xl">
                <Calendar className="text-emerald-600 w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Sesiones Registradas</p>
                <p className="text-2xl font-bold text-slate-900">{sessions.length}</p>
              </div>
            </div>
          </motion.div>
          <motion.div whileHover={{ y: -2 }} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-xl">
                <BookOpen className="text-purple-600 w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Talleres registrados</p>
                <p className="text-2xl font-bold text-slate-900">{workshops.length}</p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-8">
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Sesiones Recientes
                </h2>
                <button 
                  onClick={() => setShowAddSession(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Nueva Sesión
                </button>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Actividad</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Horario</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Duración</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Beneficiario</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sessions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                            No hay sesiones registradas aún.
                          </td>
                        </tr>
                      ) : (
                        sessions.map((session) => (
                          <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-slate-600">{session.activity}</td>
                            <td className="px-6 py-4 text-slate-600">{format(new Date(session.date), 'dd/MM/yyyy')}</td>
                            <td className="px-6 py-4 text-slate-600">{session.startTime} - {session.endTime}</td>
                            <td className="px-6 py-4">
                              <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                                {session.durationMinutes} min
                              </span>
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-900">
                              {allUsers.find(u => u.uid === session.beneficiaryId)?.name || 'Desconocido'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  Talleres Recientes
                </h2>
                <button 
                  onClick={() => setShowAddWorkshop(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Nuevo Taller
                </button>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Tipo de taller</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Profesional</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Beneficiarios</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {workshops.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                            No hay talleres registrados aún.
                          </td>
                        </tr>
                      ) : (
                        workshops.map((workshop) => (
                          <tr key={workshop.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-medium text-slate-900">{workshop.title}</div>
                              <div className="text-xs text-slate-500">{workshop.type}</div>
                            </td>
                            <td className="px-6 py-4 text-slate-600">{format(new Date(workshop.date), 'dd/MM/yyyy')}</td>
                            <td className="px-6 py-4 text-slate-600">
                              {allUsers.find(u => u.uid === workshop.professionalId)?.name || 'Desconocido'}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1">
                                {workshop.beneficiaryIds.map(id => (
                                  <span key={id} className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-[10px] font-medium">
                                    {allUsers.find(u => u.uid === id)?.name || 'Usuario'}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showAddSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddSession(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-900">Registrar Nueva Sesión</h2>
              </div>
              <form onSubmit={handleAddSession} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Beneficiario</label>
                  <select 
                    required
                    value={newSession.beneficiaryId}
                    onChange={e => setNewSession({...newSession, beneficiaryId: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Seleccionar usuario...</option>
                    {allUsers.filter(u => u.role === 'beneficiary').map(u => (
                      <option key={u.uid} value={u.uid}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Actividad</label>
                  <input 
                    required
                    type="text"
                    placeholder="Ej: Fisioterapia, Taller de arte..."
                    value={newSession.activity}
                    onChange={e => setNewSession({...newSession, activity: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                    <input 
                      required
                      type="date"
                      value={newSession.date}
                      onChange={e => setNewSession({...newSession, date: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Inicio</label>
                      <input 
                        required
                        type="time"
                        value={newSession.startTime}
                        onChange={e => setNewSession({...newSession, startTime: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Fin</label>
                      <input 
                        required
                        type="time"
                        value={newSession.endTime}
                        onChange={e => setNewSession({...newSession, endTime: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddSession(false)}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                  >
                    Guardar Sesión
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Workshop Modal */}
      <AnimatePresence>
        {showAddWorkshop && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddWorkshop(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-900">Registrar Nuevo Taller</h2>
              </div>
              <form onSubmit={handleAddWorkshop} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Título del Taller</label>
                  <input 
                    required
                    type="text"
                    placeholder="Ej: Taller de Pintura Adaptada"
                    value={newWorkshop.title}
                    onChange={e => setNewWorkshop({...newWorkshop, title: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Taller</label>
                  <input 
                    required
                    type="text"
                    placeholder="Ej: Creativo, Educativo, Deportivo..."
                    value={newWorkshop.type}
                    onChange={e => setNewWorkshop({...newWorkshop, type: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                  <input 
                    required
                    type="date"
                    value={newWorkshop.date}
                    onChange={e => setNewWorkshop({...newWorkshop, date: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Beneficiarios (Mantén presionado Ctrl/Cmd para seleccionar varios)</label>
                  <select 
                    multiple
                    required
                    value={newWorkshop.beneficiaryIds}
                    onChange={e => {
                      const options = e.target.options;
                      const values = [];
                      for (let i = 0; i < options.length; i++) {
                        if (options[i].selected) {
                          values.push(options[i].value);
                        }
                      }
                      setNewWorkshop({...newWorkshop, beneficiaryIds: values});
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-purple-500 outline-none min-h-[120px]"
                  >
                    {allUsers.filter(u => u.role === 'beneficiary').map(u => (
                      <option key={u.uid} value={u.uid}>{u.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">Has seleccionado {newWorkshop.beneficiaryIds.length} beneficiarios.</p>
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddWorkshop(false)}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200"
                  >
                    Guardar Taller
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
