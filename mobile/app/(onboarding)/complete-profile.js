import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Linking,
  Switch,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/features/auth/context/AuthContext';
import profileService from '../../src/features/auth/services/profileService';
import {
  User, MapPin, Droplets, Activity, ChevronLeft, ChevronRight, Save,
  ChevronDown, X, Heart,
} from 'lucide-react-native';

const TOTAL_STEPS = 4;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_MAP = {
  January: '01', February: '02', March: '03', April: '04', May: '05', June: '06',
  July: '07', August: '08', September: '09', October: '10', November: '11', December: '12',
};

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => (currentYear - i).toString());

const generateDays = (month, year) => {
  const m = MONTHS.indexOf(month);
  if (m === -1 || !year) return Array.from({ length: 31 }, (_, i) => (i + 1).toString());
  const daysInMonth = new Date(parseInt(year), m + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
};

const PickerModal = ({ visible, options, selected, onSelect, onClose, title }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>
        <FlatList
          data={options}
          keyExtractor={(item) => item}
          showsVerticalScrollIndicator={false}
          initialNumToRender={20}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.modalOption, selected === item && styles.modalOptionActive]}
              onPress={() => { onSelect(item); onClose(); }}
            >
              <Text style={[styles.modalOptionText, selected === item && styles.modalOptionTextActive]}>
                {item}
              </Text>
              {selected === item && (
                <View style={styles.checkCircle}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      </View>
    </TouchableOpacity>
  </Modal>
);

const StepIndicator = ({ currentStep }) => {
  const steps = [
    { num: 1, label: 'Identity' },
    { num: 2, label: 'Health' },
    { num: 3, label: 'Medical' },
    { num: 4, label: 'Emergency' },
  ];

  return (
    <View style={styles.stepsContainer}>
      {steps.map((step, index) => (
        <View key={step.num} style={styles.stepWrapper}>
          <View style={[styles.stepCircle, currentStep >= step.num && styles.stepCircleActive]}>
            <Text style={[styles.stepCircleText, currentStep >= step.num && styles.stepCircleTextActive]}>
              {currentStep > step.num ? '✓' : step.num}
            </Text>
          </View>
          <Text style={[styles.stepLabel, currentStep >= step.num && styles.stepLabelActive]}>
            {step.label}
          </Text>
          {index < steps.length - 1 && (
            <View style={[styles.stepConnector, currentStep > step.num && styles.stepConnectorActive]} />
          )}
        </View>
      ))}
    </View>
  );
};

const InputField = ({ label, value, onChangeText, placeholder, keyboardType }) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={styles.inputRow}>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
      />
    </View>
  </View>
);

const PickerField = ({ label, value, onPress, placeholder }) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TouchableOpacity style={styles.pickerButton} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.pickerText, !value && styles.pickerPlaceholder]}>
        {value || placeholder}
      </Text>
      <ChevronDown size={16} color="#94A3B8" />
    </TouchableOpacity>
  </View>
);

const SmallPicker = ({ value, onPress, placeholder, flex }) => (
  <TouchableOpacity
    style={[styles.smallPicker, flex ? { flex } : {}]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.smallPickerText, !value && { color: '#94A3B8' }]} numberOfLines={1}>
      {value || placeholder}
    </Text>
    <ChevronDown size={12} color="#94A3B8" />
  </TouchableOpacity>
);

const MultiSelectField = ({ label, value, options, field, onMultiSelect }) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={styles.chipRow}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, value.includes(opt) && styles.chipActive]}
          onPress={() => onMultiSelect(field, opt)}
          activeOpacity={0.7}
        >
          <Text style={[styles.chipText, value.includes(opt) && styles.chipTextActive]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [constants, setConstants] = useState(null);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const fadeAnim = useState(new Animated.Value(1))[0];

  const [formData, setFormData] = useState({
    countryCode: '+212',
    phoneNumber: '',
    dobDay: '',
    dobMonth: '',
    dobYear: '',
    gender: '',
    bloodType: '',
    country: 'Morocco',
    city: '',
    preferredLanguage: 'Arabic',
    weight: '',
    height: '',
    isPregnant: false,
    drugAllergies: ['None'],
    chronicDiseases: ['None (Healthy)'],
    smokingStatus: 'Non-smoker',
    alcoholStatus: 'Never',
    insuranceType: 'None / Self-Pay',
    medications: [],
    preferredHospital: '',
    latitude: null,
    longitude: null,
    emergencyContacts: [{ name: '', relationship: '', phone: '' }],
  });

  const [medicationSearch, setMedicationSearch] = useState('');
  const [medicationResults, setMedicationResults] = useState([]);
  const [searchingMed, setSearchingMed] = useState(false);

  const [hospitalSearch, setHospitalSearch] = useState('');
  const [hospitalResults, setHospitalResults] = useState([]);
  const [searchingHospitals, setSearchingHospitals] = useState(false);

  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showCountryCodePicker, setShowCountryCodePicker] = useState(false);
  const [showBloodTypePicker, setShowBloodTypePicker] = useState(false);
  const [showSmokingPicker, setShowSmokingPicker] = useState(false);
  const [showInsurancePicker, setShowInsurancePicker] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showRelationshipPicker, setShowRelationshipPicker] = useState(null);

  const days = generateDays(formData.dobMonth, formData.dobYear);

  useEffect(() => {
    const fetchConstants = async () => {
      try {
        const data = await profileService.getConstants();
        setConstants(data);
      } catch (err) {
        setError('Failed to load form options');
      } finally {
        setLoading(false);
      }
    };
    fetchConstants();
  }, []);

  useEffect(() => {
    if (medicationSearch.length < 3) {
      setMedicationResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchingMed(true);
      try {
        const res = await fetch(`https://medicament-api.vercel.app/api/medicaments/search?keyword=${medicationSearch}`);
        const json = await res.json();
        setMedicationResults(Array.isArray(json) ? json.slice(0, 5) : []);
      } catch (err) {
        console.error('Medication search error:', err);
      } finally {
        setSearchingMed(false);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [medicationSearch]);

  useEffect(() => {
    if (hospitalSearch.length < 2) {
      setHospitalResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchingHospitals(true);
      try {
        const cityQuery = formData.city ? `, ${formData.city}` : '';
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(hospitalSearch + ' hospital' + cityQuery)}&format=json&limit=7`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const json = await res.json();
        const results = Array.isArray(json)
          ? json.map((p, i) => ({
              id: p.place_id || i,
              name: p.display_name.split(',')[0],
              address: p.display_name.split(',').slice(1, 3).join(',').trim(),
            }))
          : [];
        setHospitalResults(results);
      } catch (err) {
        console.error('Hospital search error:', err);
      } finally {
        setSearchingHospitals(false);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [hospitalSearch, formData.city]);

  const fetchNearbyHospitals = async () => {
    if (!formData.city && !formData.latitude) return;
    setSearchingHospitals(true);
    try {
      let query = `hospital+${encodeURIComponent(formData.city || '')}`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=10`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const json = await res.json();
      const results = Array.isArray(json)
        ? json.filter(p => p.display_name).map((p, i) => ({
            id: p.place_id || i,
            name: p.display_name.split(',')[0],
            address: p.display_name.split(',').slice(1, 3).join(',').trim(),
          }))
        : [];
      setHospitalResults(results);
    } catch (err) {
      console.error('Nearby hospitals error:', err);
    } finally {
      setSearchingHospitals(false);
    }
  };

  const animateStep = (next) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    setCurrentStep(next);
  };

  const addMedication = (med) => {
    if (!formData.medications.find(m => m.id === med.id)) {
      setFormData(prev => ({
        ...prev,
        medications: [...prev.medications, { ...med, frequency: 'Once a day' }],
      }));
    }
    setMedicationSearch('');
    setMedicationResults([]);
  };

  const removeMedication = (id) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.filter(m => m.id !== id),
    }));
  };

  const handleMultiSelect = (field, value) => {
    setFormData(prev => {
      const current = prev[field];
      if (value.includes('None')) {
        return { ...prev, [field]: [value] };
      }
      let updated = current.filter(v => !v.includes('None'));
      if (updated.includes(value)) {
        updated = updated.filter(v => v !== value);
      } else {
        updated = [...updated, value];
      }
      if (updated.length === 0) {
        updated = [field === 'chronicDiseases' ? 'None (Healthy)' : 'None'];
      }
      return { ...prev, [field]: updated };
    });
  };

  const handleContactChange = (index, field, value) => {
    const newContacts = [...formData.emergencyContacts];
    newContacts[index][field] = value;
    setFormData({ ...formData, emergencyContacts: newContacts });
  };

  const addContact = () => {
    setFormData({
      ...formData,
      emergencyContacts: [...formData.emergencyContacts, { name: '', relationship: '', phone: '' }],
    });
  };

  const removeContact = (index) => {
    if (formData.emergencyContacts.length > 1) {
      setFormData({
        ...formData,
        emergencyContacts: formData.emergencyContacts.filter((_, i) => i !== index),
      });
    }
  };

  const [gpsLoading, setGpsLoading] = useState(false);
  const [locationName, setLocationName] = useState('');

  const reverseGeocode = async (lat, lon) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (data?.address) {
        const addr = data.address;
        const parts = [];
        if (addr.neighbourhood) parts.push(addr.neighbourhood);
        if (addr.suburb) parts.push(addr.suburb);
        if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
        if (addr.state) parts.push(addr.state);
        if (addr.country) parts.push(addr.country);
        const readable = parts.join(', ');
        setLocationName(readable || data.display_name?.split(',').slice(0, 3).join(', ') || `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
        const detectedCity = addr.city || addr.town || addr.village || '';
        if (detectedCity && !formData.city) {
          setFormData(prev => ({ ...prev, city: detectedCity }));
        }
        return;
      }
    } catch (e) {
      console.error('Reverse geocode error:', e);
    }
    setLocationName(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
  };

  const handleGPS = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsLoading(false);
        Alert.alert(
          'Location Permission Needed',
          'SHIFAA uses your location to find nearby hospitals and emergency services. Please enable location access in Settings.',
          [
            { text: 'Not Now', style: 'cancel' },
            { text: 'Go to Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setFormData(prev => ({ ...prev, latitude: loc.coords.latitude, longitude: loc.coords.longitude }));
      await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
    } catch (err) {
      setError('Failed to get location. Please try again.');
    } finally {
      setGpsLoading(false);
    }
  };

  const getDateOfBirth = () => {
    if (formData.dobDay && formData.dobMonth && formData.dobYear) {
      const m = MONTH_MAP[formData.dobMonth];
      const d = formData.dobDay.padStart(2, '0');
      return `${formData.dobYear}-${m}-${d}`;
    }
    return '';
  };

  const validateStep = () => {
    setError('');
    if (currentStep === 1) {
      if (!formData.phoneNumber) { setError('Phone number is required'); return false; }
      if (!formData.dobDay || !formData.dobMonth || !formData.dobYear) { setError('Date of birth is required'); return false; }
      if (!formData.gender) { setError('Gender is required'); return false; }
      if (!formData.city) { setError('City is required'); return false; }
    }
    if (currentStep === 2) {
      if (!formData.weight) { setError('Weight is required'); return false; }
      if (!formData.height) { setError('Height is required'); return false; }
      if (!formData.bloodType) { setError('Blood type is required'); return false; }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      animateStep(Math.min(currentStep + 1, TOTAL_STEPS));
    }
  };

  const prevStep = () => {
    animateStep(Math.max(currentStep - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    setError('');
    try {
      const fullPhoneNumber = `${formData.countryCode} ${formData.phoneNumber}`;
      const payload = {
        phoneNumber: fullPhoneNumber,
        dateOfBirth: getDateOfBirth(),
        gender: formData.gender,
        bloodType: formData.bloodType,
        city: formData.city,
        country: formData.country,
        preferredLanguage: formData.preferredLanguage,
        weight: formData.weight ? parseInt(formData.weight) : null,
        height: formData.height ? parseInt(formData.height) : null,
        isPregnant: formData.isPregnant,
        drugAllergies: formData.drugAllergies,
        chronicDiseases: formData.chronicDiseases,
        smokingStatus: formData.smokingStatus,
        alcoholStatus: formData.alcoholStatus,
        insuranceType: formData.insuranceType,
        medications: formData.medications,
        preferredHospital: formData.preferredHospital,
        latitude: formData.latitude,
        longitude: formData.longitude,
        emergencyContacts: formData.emergencyContacts,
      };

      await profileService.updateProfile(payload);
      await refreshUser();
      router.replace('/(main)/dashboard');
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to update profile';
      const missing = err.response?.data?.missingFields;
      setError(missing ? `${errMsg}: ${missing.join(', ')}` : errMsg);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  const countryCodes = constants?.geography.COUNTRY_CODES || [];
  const moroccanCities = constants?.geography.MOROCCAN_CITIES || [];
  const genders = constants?.medical.GENDERS || ['Male', 'Female'];
  const bloodTypes = constants?.medical.BLOOD_TYPES || ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const smokingOptions = constants?.medical.LIFESTYLE?.SMOKING || ['Non-smoker', 'Smoker', 'Former smoker'];
  const insuranceOptions = constants?.medical.INSURANCE_MOROCCO || ['AMO', 'CNOPS', 'Private', 'None / Self-Pay'];
  const relationships = constants?.medical.RELATIONSHIPS || ['Father', 'Mother', 'Spouse', 'Brother', 'Sister', 'Son', 'Daughter', 'Friend', 'Other'];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View>
            <View style={styles.stepIntro}>
              <View style={styles.stepIconBox}>
                <User size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.stepIntroTitle}>Personal Identity</Text>
              <Text style={styles.stepIntroSub}>Your basic contact and location information</Text>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Phone Number</Text>
                <View style={styles.phoneRow}>
                  <TouchableOpacity
                    style={styles.codePicker}
                    onPress={() => setShowCountryCodePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.codePickerText}>{formData.countryCode}</Text>
                    <ChevronDown size={14} color="#94A3B8" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.phoneInput}
                    value={formData.phoneNumber}
                    onChangeText={v => setFormData(p => ({ ...p, phoneNumber: v }))}
                    placeholder="600-000000"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Date of Birth</Text>
                <View style={styles.dobRow}>
                  <SmallPicker value={formData.dobDay} onPress={() => setShowDayPicker(true)} placeholder="Day" flex={1} />
                  <SmallPicker value={formData.dobMonth} onPress={() => setShowMonthPicker(true)} placeholder="Month" flex={2} />
                  <SmallPicker value={formData.dobYear} onPress={() => setShowYearPicker(true)} placeholder="Year" flex={1.5} />
                </View>
              </View>

              <PickerField label="Gender" value={formData.gender} onPress={() => setShowGenderPicker(true)} placeholder="Select gender" />
              {formData.gender === 'Female' && (
                <View style={[styles.fieldGroup, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingVertical: 5 }]}>
                  <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>Are you currently pregnant?</Text>
                  <Switch
                    value={formData.isPregnant}
                    onValueChange={(value) => setFormData(p => ({ ...p, isPregnant: value }))}
                    trackColor={{ false: '#E2E8F0', true: '#8B5CF6' }}
                    thumbColor={'#FFFFFF'}
                  />
                </View>
              )}
              <PickerField label="Country" value={formData.country} onPress={() => {}} />
              {formData.country === 'Morocco' ? (
                <PickerField label="City" value={formData.city} onPress={() => setShowCityPicker(true)} placeholder="Select city" />
              ) : (
                <InputField label="City" value={formData.city} onChangeText={v => setFormData(p => ({ ...p, city: v }))} placeholder="City name" />
              )}
            </View>
          </View>
        );

      case 2:
        return (
          <View>
            <View style={styles.stepIntro}>
              <View style={[styles.stepIconBox, { backgroundColor: '#EF4444' }]}>
                <Heart size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.stepIntroTitle}>Health Profile</Text>
              <Text style={styles.stepIntroSub}>Your physical vitals and lifestyle information</Text>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <InputField label="Weight (kg)" value={formData.weight} onChangeText={v => setFormData(p => ({ ...p, weight: v }))} placeholder="70" keyboardType="numeric" />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <InputField label="Height (cm)" value={formData.height} onChangeText={v => setFormData(p => ({ ...p, height: v }))} placeholder="175" keyboardType="numeric" />
                </View>
              </View>

              <PickerField label="Blood Type" value={formData.bloodType} onPress={() => setShowBloodTypePicker(true)} placeholder="Select blood type" />
              <PickerField label="Smoking Status" value={formData.smokingStatus} onPress={() => setShowSmokingPicker(true)} placeholder="Select" />
              <PickerField label="Insurance Type" value={formData.insuranceType} onPress={() => setShowInsurancePicker(true)} placeholder="Select insurance" />
            </View>
          </View>
        );

      case 3:
        return (
          <View>
            <View style={styles.stepIntro}>
              <View style={[styles.stepIconBox, { backgroundColor: '#8B5CF6' }]}>
                <Droplets size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.stepIntroTitle}>Medical Profile</Text>
              <Text style={styles.stepIntroSub}>Allergies, conditions and medications</Text>
            </View>

            <View style={styles.sectionCard}>
              {constants?.medical.ALLERGIES?.DRUGS && (
                <MultiSelectField label="Drug Allergies" value={formData.drugAllergies} options={constants.medical.ALLERGIES.DRUGS} field="drugAllergies" onMultiSelect={handleMultiSelect} />
              )}
              {constants?.medical.CHRONIC_CONDITIONS && (
                <MultiSelectField label="Chronic Conditions" value={formData.chronicDiseases} options={constants.medical.CHRONIC_CONDITIONS} field="chronicDiseases" onMultiSelect={handleMultiSelect} />
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Medications</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.fieldInput}
                    value={medicationSearch}
                    onChangeText={setMedicationSearch}
                    placeholder="Search medication..."
                    placeholderTextColor="#94A3B8"
                  />
                  {searchingMed && <ActivityIndicator size="small" color="#2563EB" style={{ marginRight: 8 }} />}
                </View>
                {medicationResults.map(med => (
                  <TouchableOpacity key={med.id} style={styles.searchResult} onPress={() => addMedication(med)} activeOpacity={0.7}>
                    <View>
                      <Text style={styles.searchResultText}>{med.nom}</Text>
                      <Text style={styles.searchResultSub}>{med.forme} - {med.dosage1}</Text>
                    </View>
                    <Text style={styles.addLabel}>+ Add</Text>
                  </TouchableOpacity>
                ))}
                {formData.medications.map(med => (
                  <View key={med.id} style={styles.medItem}>
                    <View>
                      <Text style={styles.medName}>{med.nom}</Text>
                      <Text style={styles.medDosage}>{med.dosage1}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeMedication(med.id)}>
                      <Text style={styles.removeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {formData.medications.length === 0 && !medicationSearch && (
                  <Text style={styles.emptyHint}>No medications added yet.</Text>
                )}
              </View>
            </View>
          </View>
        );

      case 4:
        return (
          <View>
            <View style={styles.stepIntro}>
              <View style={[styles.stepIconBox, { backgroundColor: '#F59E0B' }]}>
                <MapPin size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.stepIntroTitle}>Emergency & Logistics</Text>
              <Text style={styles.stepIntroSub}>Your hospital preference and emergency contacts</Text>
            </View>

            <View style={styles.sectionCard}>
              {/* Location Card */}
              <View style={[styles.locationCard, formData.latitude && styles.locationCardActive]}>
                <View style={styles.locationHeader}>
                  <MapPin size={20} color={formData.latitude ? '#2563EB' : '#94A3B8'} />
                  <Text style={[styles.locationTitle, formData.latitude && { color: '#2563EB' }]}>
                    {formData.latitude ? 'Location Saved' : 'Your Location'}
                  </Text>
                </View>
                {formData.latitude ? (
                  <View style={styles.locationDetails}>
                    <MapPin size={16} color="#2563EB" />
                    <Text style={styles.locationName}>{locationName}</Text>
                    <TouchableOpacity onPress={handleGPS} style={styles.relocateBtn}>
                      <Text style={styles.relocateBtnText}>Update</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.locationHint}>
                    Save your location to find nearby hospitals
                  </Text>
                )}
              </View>

              <TouchableOpacity style={styles.gpsButton} onPress={handleGPS} activeOpacity={0.8} disabled={gpsLoading}>
                {gpsLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <MapPin size={18} color="#FFFFFF" />
                )}
                <Text style={styles.gpsButtonText}>
                  {gpsLoading ? 'Getting location...' : 'Save My Current Location'}
                </Text>
              </TouchableOpacity>

              {/* Hospital Search */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Preferred Hospital</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.fieldInput}
                    value={hospitalSearch}
                    onChangeText={setHospitalSearch}
                    placeholder={formData.city ? `Search hospital in ${formData.city}...` : 'Search hospital...'}
                    placeholderTextColor="#94A3B8"
                  />
                  {searchingHospitals && <ActivityIndicator size="small" color="#2563EB" style={{ marginRight: 8 }} />}
                </View>
                {!hospitalSearch && formData.city && (
                  <TouchableOpacity style={styles.nearbyBtn} onPress={fetchNearbyHospitals} activeOpacity={0.7}>
                    <MapPin size={14} color="#2563EB" />
                    <Text style={styles.nearbyBtnText}>Show hospitals near {formData.city}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {formData.preferredHospital && (
                <View style={styles.selectedHospital}>
                  <Text style={styles.selectedHospitalLabel}>Selected</Text>
                  <Text style={styles.selectedHospitalName}>{formData.preferredHospital}</Text>
                  <TouchableOpacity onPress={() => setFormData(p => ({ ...p, preferredHospital: '' }))}>
                    <Text style={styles.changeText}>Change</Text>
                  </TouchableOpacity>
                </View>
              )}

              {hospitalResults.map(h => (
                <TouchableOpacity
                  key={h.id}
                  style={[styles.hospitalResult, formData.preferredHospital === h.name && styles.hospitalResultActive]}
                  onPress={() => { setFormData(p => ({ ...p, preferredHospital: h.name })); setHospitalSearch(''); setHospitalResults([]); }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hospitalName}>{h.name}</Text>
                    <Text style={styles.hospitalAddress}>{h.address}</Text>
                  </View>
                  {formData.preferredHospital === h.name && (
                    <View style={styles.checkCircle}><Text style={styles.checkMark}>✓</Text></View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.fieldLabel}>Emergency Contacts</Text>
                <TouchableOpacity onPress={addContact}>
                  <View style={styles.addContactBtn}>
                    <Text style={styles.addContactBtnText}>+ Add</Text>
                  </View>
                </TouchableOpacity>
              </View>
              {formData.emergencyContacts.map((contact, index) => (
                <View key={index} style={styles.contactCard}>
                  <View style={styles.contactIndex}>
                    <Text style={styles.contactIndexText}>{index + 1}</Text>
                  </View>
                  <TextInput
                    style={styles.contactInput}
                    value={contact.name}
                    onChangeText={v => handleContactChange(index, 'name', v)}
                    placeholder="Full name"
                    placeholderTextColor="#94A3B8"
                  />
                  <TouchableOpacity
                    style={styles.contactPickerBtn}
                    onPress={() => setShowRelationshipPicker(index)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.contactPickerText, !contact.relationship && { color: '#94A3B8' }]}>
                      {contact.relationship || 'Relationship'}
                    </Text>
                    <ChevronDown size={14} color="#94A3B8" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.contactInput}
                    value={contact.phone}
                    onChangeText={v => handleContactChange(index, 'phone', v)}
                    placeholder="Phone number"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                  />
                  {formData.emergencyContacts.length > 1 && (
                    <TouchableOpacity onPress={() => removeContact(index)} style={{ alignSelf: 'flex-end' }}>
                      <Text style={styles.removeContact}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <View style={styles.logoBox}><Text style={styles.logoText}>S</Text></View>
            <Text style={styles.brandName}>Complete Profile</Text>
          </View>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>{currentStep}/{TOTAL_STEPS}</Text>
          </View>
        </View>

        <StepIndicator currentStep={currentStep} />

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <Animated.View style={{ opacity: fadeAnim }}>
            {renderStepContent()}
          </Animated.View>
          <View style={{ height: 80 }} />
        </ScrollView>

        <View style={styles.bottomBar}>
          {currentStep > 1 && (
            <TouchableOpacity style={styles.backBtn} onPress={prevStep} activeOpacity={0.7}>
              <ChevronLeft size={20} color="#64748B" />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          {currentStep < TOTAL_STEPS ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={nextStep} activeOpacity={0.8}>
              <Text style={styles.primaryBtnText}>Continue</Text>
              <ChevronRight size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.8}>
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Save size={20} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Complete</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      <PickerModal visible={showGenderPicker} options={genders} selected={formData.gender} onSelect={v => setFormData(p => ({ ...p, gender: v }))} onClose={() => setShowGenderPicker(false)} title="Select Gender" />
      <PickerModal visible={showBloodTypePicker} options={bloodTypes} selected={formData.bloodType} onSelect={v => setFormData(p => ({ ...p, bloodType: v }))} onClose={() => setShowBloodTypePicker(false)} title="Select Blood Type" />
      <PickerModal visible={showSmokingPicker} options={smokingOptions} selected={formData.smokingStatus} onSelect={v => setFormData(p => ({ ...p, smokingStatus: v }))} onClose={() => setShowSmokingPicker(false)} title="Select Smoking Status" />
      <PickerModal visible={showInsurancePicker} options={insuranceOptions} selected={formData.insuranceType} onSelect={v => setFormData(p => ({ ...p, insuranceType: v }))} onClose={() => setShowInsurancePicker(false)} title="Select Insurance Type" />
      <PickerModal visible={showCityPicker} options={moroccanCities} selected={formData.city} onSelect={v => setFormData(p => ({ ...p, city: v }))} onClose={() => setShowCityPicker(false)} title="Select City" />
      <PickerModal visible={showDayPicker} options={days} selected={formData.dobDay} onSelect={v => setFormData(p => ({ ...p, dobDay: v }))} onClose={() => setShowDayPicker(false)} title="Select Day" />
      <PickerModal visible={showMonthPicker} options={MONTHS} selected={formData.dobMonth} onSelect={v => setFormData(p => ({ ...p, dobMonth: v }))} onClose={() => setShowMonthPicker(false)} title="Select Month" />
      <PickerModal visible={showYearPicker} options={YEARS} selected={formData.dobYear} onSelect={v => setFormData(p => ({ ...p, dobYear: v }))} onClose={() => setShowYearPicker(false)} title="Select Year" />

      <Modal visible={showCountryCodePicker} transparent animationType="slide" onRequestClose={() => setShowCountryCodePicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCountryCodePicker(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Country Code</Text>
              <TouchableOpacity onPress={() => setShowCountryCodePicker(false)}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={countryCodes}
              keyExtractor={(item) => item.code}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalOption, formData.countryCode === item.code && styles.modalOptionActive]}
                  onPress={() => { setFormData(p => ({ ...p, countryCode: item.code })); setShowCountryCodePicker(false); }}
                >
                  <Text style={[styles.modalOptionText, formData.countryCode === item.code && styles.modalOptionTextActive]}>
                    {item.country} ({item.code})
                  </Text>
                  {formData.countryCode === item.code && (
                    <View style={styles.checkCircle}><Text style={styles.checkMark}>✓</Text></View>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {showRelationshipPicker !== null && (
        <PickerModal
          visible={showRelationshipPicker !== null}
          options={relationships}
          selected={formData.emergencyContacts[showRelationshipPicker]?.relationship}
          onSelect={v => handleContactChange(showRelationshipPicker, 'relationship', v)}
          onClose={() => setShowRelationshipPicker(null)}
          title="Select Relationship"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: { width: 30, height: 30, backgroundColor: '#2563EB', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  brandName: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  stepBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  stepBadgeText: { fontSize: 12, fontWeight: '800', color: '#2563EB' },
  stepsContainer: {
    flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  stepWrapper: { alignItems: 'center', flex: 1, position: 'relative' },
  stepCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  stepCircleActive: { backgroundColor: '#2563EB' },
  stepCircleText: { fontSize: 11, fontWeight: '800', color: '#94A3B8' },
  stepCircleTextActive: { color: '#FFFFFF' },
  stepLabel: { fontSize: 9, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  stepLabelActive: { color: '#2563EB' },
  stepConnector: { position: 'absolute', top: 13, left: '60%', right: -10, height: 2, backgroundColor: '#E2E8F0' },
  stepConnectorActive: { backgroundColor: '#2563EB' },
  content: { flex: 1, padding: 20 },
  stepIntro: { alignItems: 'center', marginBottom: 24 },
  stepIconBox: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  stepIntroTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  stepIntroSub: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14 },
  fieldInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#0F172A', fontWeight: '500' },
  pickerButton: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerText: { fontSize: 15, color: '#0F172A', fontWeight: '500' },
  pickerPlaceholder: { color: '#94A3B8', fontWeight: '400' },
  phoneRow: { flexDirection: 'row', gap: 8 },
  codePicker: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  codePickerText: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  phoneInput: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#0F172A', fontWeight: '500' },
  dobRow: { flexDirection: 'row', gap: 8 },
  smallPicker: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  smallPickerText: { fontSize: 14, color: '#0F172A', fontWeight: '500' },
  row: { flexDirection: 'row' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#FFFFFF' },
  searchResult: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 6 },
  searchResultText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  searchResultSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  addLabel: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  medItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 6 },
  medName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  medDosage: { fontSize: 12, color: '#64748B' },
  removeText: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  emptyHint: { fontSize: 13, color: '#94A3B8', fontStyle: 'italic', marginTop: 8 },
  gpsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', paddingVertical: 14, borderRadius: 14, marginTop: 4 },
  gpsButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  locationCard: { backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, marginBottom: 16 },
  locationCardActive: { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  locationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  locationTitle: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  locationDetails: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 28 },
  locationName: { fontSize: 14, color: '#2563EB', fontWeight: '600', flex: 1 },
  locationHint: { fontSize: 13, color: '#94A3B8', paddingLeft: 28 },
  relocateBtn: { backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  relocateBtnText: { fontSize: 12, fontWeight: '600', color: '#2563EB' },
  nearbyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingVertical: 6 },
  nearbyBtnText: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  selectedHospital: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 8 },
  selectedHospitalLabel: { fontSize: 10, fontWeight: '800', color: '#2563EB', textTransform: 'uppercase', letterSpacing: 1 },
  selectedHospitalName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0F172A' },
  changeText: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  hospitalResult: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 6, gap: 8 },
  hospitalResultActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  hospitalName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  hospitalAddress: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  addContactBtn: { backgroundColor: '#EFF6FF', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  addContactBtnText: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  contactCard: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16, marginBottom: 12, gap: 10 },
  contactIndex: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  contactIndexText: { fontSize: 12, fontWeight: '800', color: '#64748B' },
  contactInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0F172A' },
  contactPickerBtn: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contactPickerText: { fontSize: 14, color: '#0F172A' },
  removeContact: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#FCA5A5', marginBottom: 16 },
  errorIcon: { fontSize: 16 },
  errorText: { color: '#B91C1C', fontSize: 14, fontWeight: '600', flex: 1 },
  bottomBar: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, backgroundColor: '#F1F5F9' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563EB', paddingVertical: 13, paddingHorizontal: 24, borderRadius: 14, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  primaryBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#22C55E', paddingVertical: 13, paddingHorizontal: 24, borderRadius: 14, shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '60%', paddingBottom: 34 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  modalOptionActive: { backgroundColor: '#EFF6FF' },
  modalOptionText: { fontSize: 16, color: '#0F172A', fontWeight: '500' },
  modalOptionTextActive: { color: '#2563EB', fontWeight: '700' },
  checkCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  checkMark: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
