import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
  Alert,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/features/auth/context/AuthContext';
import { isFallDetectionRunning } from '../../src/features/safety/services/fallDetectionService';
import {
  Settings,
  ShieldAlert,
  ShieldCheck,
  MapPin,
  Phone,
  Bot,
  HeartPulse,
  Egg,
  LayoutDashboard,
  FileText,
  Stethoscope,
  Activity,
  Brain,
} from 'lucide-react-native';

export default function DashboardScreen() {
  const { user, logout, isProfileComplete } = useAuth();
  const router = useRouter();
  const [fallActive, setFallActive] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFallActive(isFallDetectionRunning());
    }, [])
  );

  useEffect(() => {
    if (!isProfileComplete) {
      router.replace('/(onboarding)/complete-profile');
    }
  }, []);

  const getAge = (dob) => {
    if (!dob) return '--';
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const getBMI = () => {
    if (user?.profile?.weight && user?.profile?.height) {
      return (user.profile.weight / Math.pow(user.profile.height/100, 2)).toFixed(1);
    }
    return '--';
  };

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out of Shifaa?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Log Out", 
          style: "destructive", 
          onPress: () => {
            logout();
            router.replace('/(auth)/login');
          }
        }
      ]
    );
  };

  const handleComingSoon = (feature) => {
    Alert.alert("Coming Soon", `${feature} is currently under development.`);
  };

  const renderChronicBadge = (condition, index) => {
    const cleanCond = condition.trim();
    if (!cleanCond) return null;
    
    const isAllergy = cleanCond.toLowerCase().includes('allergy') || cleanCond.toLowerCase().includes('egg') || cleanCond.toLowerCase().includes('nut');
    const isHypertension = cleanCond.toLowerCase().includes('hyper') || cleanCond.toLowerCase().includes('blood') || cleanCond.toLowerCase().includes('heart');
    
    let bgColor = '#dae2fd'; // secondary-container
    let textColor = '#3f465c'; // on-secondary-fixed-variant
    let IconComponent = Stethoscope;

    if (isAllergy) {
      bgColor = '#e9ddff'; // tertiary-fixed
      textColor = '#5516be'; // on-tertiary-fixed-variant
      IconComponent = Egg;
    } else if (isHypertension) {
      bgColor = '#dbe1ff'; // primary-fixed
      textColor = '#003ea8'; // on-primary-fixed-variant
      IconComponent = HeartPulse;
    }

    return (
      <View key={index} style={[styles.badge, { backgroundColor: bgColor }]}>
        <IconComponent size={14} color={textColor} style={styles.badgeIcon} />
        <Text style={[styles.badgeText, { color: textColor }]}>{cleanCond}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* TopAppBar */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image 
            source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBcBQQ3Rv4_KvBPE4O9-Fm_NvR4K1-OYVhcB1Oly9ZLh2Naf1-0bdmZGor0ayqgg3x6Ag0zPOD6unqPoZydCfU4W5HYcTdD6zdCFVoZXGHaulZ0AMdpKQa9_m3I5DCnp1oFR5_2kMsHty0tU_Br_uM0tmx72Jqifa8JvDiXBnyZsZvAtPENQ7HBeEsiDXjD2vlpAE16U47vx97dzRRnlP1xiSOID0eBfXxMpk14Cz9R_x6BAfZA93oWpiHISAbWG_RBoaMBZktthHk' }}
            style={styles.logoImage}
          />
          <Text style={styles.brandName}>SHIFAA</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(main)/settings')}>
            <Settings size={22} color="#434655" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarBtn} onPress={handleLogout}>
            <Image 
              source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCBBd3jO7zuKwfveSIz-BT0XZeQOhpNelIk9hDFWHLGx080Gedxmr0icO_dNJJpNDfKxZ3-eErzHykC7ntioqkzn-rur3nVaNswjqq5VgIO7BM_hKJ6X-whRTmAS7_liI5HzXLjmKzzsLzoiYimr566c0oScPetOe4bYhX-p4tU7-hIJxntfSGi0EaOe0KmrM_OUOnHfeo10FVOp2qJDNj5nZ3izWa9Bhnys2N4wRPhFBDnBAjWG5nRtnrOIqhjMwcLbvvTZ6z5pjA' }}
              style={styles.avatarImage}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Canvas */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Salam, {user?.fullName?.split(' ')[0] || 'Ahmed'}!</Text>
          <View style={styles.statusBadge}>
            <View style={styles.pulseDot} />
            <Text style={styles.statusText}>Medical Status: Stable</Text>
          </View>
        </View>

        {/* SOS Emergency Card */}
        <View style={styles.sosCard}>
          <View style={styles.sosLeft}>
            <View style={styles.sosIconBox}>
              <ShieldAlert size={24} color="#ffffff" fill="#ffffff" />
            </View>
            <View style={styles.sosTextContainer}>
              <Text style={styles.sosTitle}>Emergency SOS</Text>
              <Text style={styles.sosSubtitle}>Direct line to medical help</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.sosButton} 
            onPress={() => router.push('/(main)/emergency')}
          >
            <Phone size={20} color="#ffffff" fill="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Start AI Triage Bento Card */}
        <TouchableOpacity 
          style={styles.triageCard} 
          onPress={() => router.replace('/(main)/triage-hub')}
          activeOpacity={0.9}
        >
          <View style={styles.triageCardDecor} />
          <View style={styles.triageContent}>
            <View style={styles.triageIconBox}>
              <Bot size={28} color="#ffffff" />
            </View>
            <View style={styles.triageTextContainer}>
              <Text style={styles.triageTitle}>Start AI Triage</Text>
              <Text style={styles.triageSubtitle}>Symptom check and guidance in seconds</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Fall Detection Card */}
        <TouchableOpacity
          style={styles.fallCard}
          onPress={() => router.push('/(main)/fall-detection')}
          activeOpacity={0.9}
        >
          <View style={styles.fallCardLeft}>
            <View style={styles.fallIconBox}>
              <ShieldCheck size={24} color="#fff" />
            </View>
            <View>
              <Text style={styles.fallTitle}>Fall Detection</Text>
              <Text style={styles.fallSubtitle}>Enable protection mode</Text>
            </View>
          </View>
          <View style={styles.fallBadge(fallActive)}>
            <Text style={styles.fallBadgeText}>{fallActive ? 'ACTIVE' : 'NEW'}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Health Snapshot</Text>
        </View>

        <View style={styles.vitalsGrid}>
          <View style={styles.vitalCard}>
            <Text style={styles.vitalLabel}>Blood Group</Text>
            <Text style={styles.vitalValue}>{user?.profile?.bloodType || 'O+'}</Text>
          </View>
          <View style={styles.vitalCard}>
            <Text style={styles.vitalLabel}>Body Mass Index</Text>
            <Text style={styles.vitalValue}>{getBMI() !== '--' ? getBMI() : '22.5'}</Text>
          </View>
        </View>

        {/* Chronic Registry Tags */}
        <View style={styles.tagsContainer}>
          {user?.profile?.chronicDiseases ? (
            user.profile.chronicDiseases.split(',').map((d, i) => renderChronicBadge(d, i))
          ) : (
            <>
              {renderChronicBadge('Hypertension', 0)}
              {renderChronicBadge('Nut Allergy', 1)}
            </>
          )}
        </View>

        {/* Primary Care Hospital Location */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Primary Care Center</Text>
        </View>

        <View style={styles.hospitalCard}>
          <Image 
            source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB0FOmg2Ms3COTCEMlyoZAqvcRKi6u_A9QQfJoP4dtWqDchr1D6JSKDWpB7s41x3Q4dBk8u3-soBLE3xZQhorI83y9OrvkJtov7zcWn6CwDg1ufXdTaHTIGWsq_rfH8YgFviWgfo7LeG4nA_LHWDsLdGq8V5GTWBVBQj49eVZJlKOm42pZhlPU2OE2OJWwllDE8btNMdsTMYrGwdztMShInt4MgS0BI52p2Ygk48qBQ39x4TcoYWnw5vJ4LGgSFjnAWwjJUJSpfrrY' }}
            style={styles.hospitalMap}
          />
          <View style={styles.hospitalInfoRow}>
            <View style={styles.hospitalPinBox}>
              <MapPin size={18} color="#004ac6" />
            </View>
            <View style={styles.hospitalDetails}>
              <Text style={styles.hospitalName}>
                {user?.profile?.preferredHospital || 'CHU Hassan II, Fès'}
              </Text>
              <Text style={styles.hospitalAddress}>
                {user?.profile?.preferredHospital ? 'Route de Sidi Hrazem, Fès 30000' : 'Route de Sidi Hrazem, Fès 30000'}
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom space to scroll past navbar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItemActive} onPress={() => {}}>
          <LayoutDashboard size={20} color="#ffffff" />
          <Text style={styles.navTextActive}>Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.replace('/(main)/orchestrator')}
        >
          <Brain size={20} color="#565e74" />
          <Text style={styles.navText}>Orchestrator</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.replace('/(main)/triage-hub')}
        >
          <Activity size={20} color="#565e74" />
          <Text style={styles.navText}>Triage</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/(main)/settings')}
        >
          <Settings size={20} color="#565e74" />
          <Text style={styles.navText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#eceef0',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoImage: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  brandName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#004ac6',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f2f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#2563eb',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  heroSection: {
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#191c1e',
    letterSpacing: -0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  statusText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  sosCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1.5,
    borderColor: 'rgba(186, 26, 26, 0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  sosLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sosIconBox: {
    width: 44,
    height: 44,
    backgroundColor: '#ba1a1a',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ba1a1a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  sosTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  sosTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#191c1e',
  },
  sosSubtitle: {
    fontSize: 13,
    color: '#434655',
    marginTop: 2,
  },
  sosButton: {
    width: 44,
    height: 44,
    backgroundColor: '#ba1a1a',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Fall Detection card
  fallCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#5B21B6', borderRadius: 16, padding: 18, marginBottom: 24,
    shadowColor: '#5B21B6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 6,
  },
  fallCardLeft:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  fallIconBox:   { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  fallTitle:     { fontSize: 15, fontWeight: '800', color: '#fff' },
  fallSubtitle:  { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  fallBadge:     (active) => ({ backgroundColor: active ? '#10B981' : '#A78BFA', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 }),
  fallBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  triageCard: {

    backgroundColor: '#004ac6',
    borderRadius: 16,
    padding: 20,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
    shadowColor: '#004ac6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  triageCardDecor: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  triageContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  triageIconBox: {
    width: 52,
    height: 52,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  triageTextContainer: {
    flex: 1,
  },
  triageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
  },
  triageSubtitle: {
    fontSize: 13,
    color: '#eeefff',
    marginTop: 4,
    lineHeight: 18,
  },
  sectionHeaderRow: {
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#434655',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  vitalsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  vitalCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eceef0',
  },
  vitalLabel: {
    fontSize: 13,
    color: '#565e74',
    fontWeight: '600',
    marginBottom: 6,
  },
  vitalValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#004ac6',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeIcon: {
    marginRight: 6,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  hospitalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eceef0',
  },
  hospitalMap: {
    height: 120,
    width: '100%',
    resizeMode: 'cover',
  },
  hospitalInfoRow: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  hospitalPinBox: {
    width: 36,
    height: 36,
    backgroundColor: '#dae2fd',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  hospitalDetails: {
    flex: 1,
  },
  hospitalName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#191c1e',
  },
  hospitalAddress: {
    fontSize: 12,
    color: '#434655',
    marginTop: 2,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 88 : 72,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    borderWidth: 1,
    borderColor: '#eceef0',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  navItemActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#004ac6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  navItem: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  navTextActive: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  navText: {
    color: '#565e74',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
});

