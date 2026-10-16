/**
 * FOLK Damodar Month 2026 - Multi-User Client Application
 * Connects to Express backend API, handles sessions, live dashboards, and admin tools.
 */

(function () {
  'use strict';

  // Application State
  const state = {
    currentUser: null, // { id, username, full_name, role, residence, personal_goal, must_change_password }
    activeView: 'community', // 'community' | 'my-dashboard' | 'admin'
    communityStats: null,
    userDashboard: null,
    adminData: null,
    searchQuery: '',
    selectedResidenceFilter: 'ALL',
    selectedHeroCenter: 'FOLK PDEU',
    hasManuallySwitchedCenter: false,
    token: localStorage.getItem('folk_jwt_token') || null
  };

  // Damodarashtaka Verses (8 Verses)
  const DAMODARASHTAKA_VERSES = [
    {
      num: 1,
      sanskrit: "namāmīśvaraṁ sac-cid-ānanda-rūpaṁ lasat-kuṇḍalaṁ gokule bhrājamānam | yaśodā-bhiyolūkhalād dhāvamānaṁ parāmṛṣṭam atyantato drutya gopyā ||",
      trans: "To the supreme Lord, whose form is eternal existence, knowledge, and bliss, whose earrings swing as He plays in Gokula, and who in fear of mother Yashoda runs swiftly from the wooden mortar—I offer my respectful obeisances."
    },
    {
      num: 2,
      sanskrit: "rudantaṁ muhur netra-yugmaṁ mṛjantam karāmbhoja-yugmena sātaṅka-netram | muhuḥ śvāsa-kampa-tri-rekhāṅka-kaṇṭha-sthita-graiva-dāmodaraṁ bhakti-baddham ||",
      trans: "Seeing the whipping rod in His mother's hand, He cries and rubs His eyes with His two lotus hands, His eyes filled with fear. To this supreme Lord Damodara, who is bound not by ropes but by pure love, I offer my respectful obeisances."
    },
    {
      num: 3,
      sanskrit: "itīdṛk sva-līlābhir ānanda-kuṇḍe sva-ghoṣaṁ nimajjantam ākhyāpayantam | tadīyeśita-jñeṣu bhaktair jitatvaṁ punaḥ prematas taṁ śatāvṛtti vande ||",
      trans: "By such childhood pastimes He plunges the inhabitants of Gokula into pools of transcendental ecstasy. To this Supreme Personality of Godhead, who is conquered only by devotees surrendered in unalloyed love, I offer hundreds of obeisances."
    },
    {
      num: 4,
      sanskrit: "varaṁ deva mokṣaṁ na mokṣāvadhiṁ vā na cānyaṁ vṛṇe 'haṁ vareśād apīha | idaṁ te vapur nātha gopāla-bālaṁ sadā me manasy āvirāstāṁ kim anyaiḥ ||",
      trans: "O Lord, although You are able to grant all boons, I do not pray to You for impersonal liberation nor for any other benediction. O Lord, I only desire that Your form as baby Gopala in Vrindavana may constantly appear in my heart."
    },
    {
      num: 5,
      sanskrit: "idaṁ te mukhāmbhojam atyanta-nīlair vṛtaṁ kuntalāiḥ snigdha-raktaiś ca gopyā | muhuś cumbitaṁ bimba-raktādharaṁ me manasy āvirāstām alaṁ lakṣa-lābhāiḥ ||",
      trans: "O Lord, Your lotus face, framed by soft dark curly hair and repeatedly kissed by mother Yashoda, features lips as red as the bimba fruit. May this lotus face ever remain manifest in my heart; a hundred thousand other achievements are of no use to me."
    },
    {
      num: 6,
      sanskrit: "namo deva dāmodarānanta viṣṇo prasīda prabho duḥkha-jālābdhi-magnam | kṛpā-dṛṣṭi-vṛṣṭyāti-dīnaṁ batānu gṛhāṇeśa mām ajñam edhy akṣi-dṛśyaḥ ||",
      trans: "O Supreme Godhead, O Damodara, O Ananta, O Vishnu! Please be gracious to me. I am submerged in an ocean of worldly grief. Shower Your glance of causeless mercy upon me and lift this wretched fool up to become visible to my eyes."
    },
    {
      num: 7,
      sanskrit: "kuverātmajau baddha-mūrtyaiva yadvat tvayā mocitau bhakti-bhājau kṛtau ca | tathā prema-bhaktiṁ svakāṁ me prayaccha na mokṣe graho me 'sti dāmodareha ||",
      trans: "Just as You delivered the two sons of Kuvera, Nalakuvara and Manigriva, from their curse as twin arjuna trees and bestowed upon them devotional service, please confer upon me Your own pure prema-bhakti. I have no desire for liberation."
    },
    {
      num: 8,
      sanskrit: "namas te 'stu dāmne sphurad-dīpti-dhāmne tvadīyodarāyātha viśvasya dhāmne | namo rādhikāyai tvadīya-priyāyai namo 'nanta-līlāya devāya tubhyam ||",
      trans: "O Lord Damodara, I first offer my obeisances unto the effulgent rope binding Your belly, and unto Your belly which holds the entire cosmic universe. I offer obeisances unto Your most beloved Srimati Radharani, and to You, the Supreme Lord of limitless transcendental pastimes."
    }
  ];

  // Helper for Authenticated Fetch
  async function apiFetch(endpoint, options = {}) {
    options.headers = options.headers || {};
    if (state.token) {
      options.headers['Authorization'] = `Bearer ${state.token}`;
    }
    if (options.body && !(options.body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(endpoint, options);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP error ${res.status}`);
      }
      return data;
    } catch (err) {
      throw err;
    }
  }

  /**
   * DOM Elements
   */
  const el = {
    // Nav & Auth
    navCommunityBtn: document.getElementById('navCommunityBtn'),
    navMyDashboardBtn: document.getElementById('navMyDashboardBtn'),
    navAdminBtn: document.getElementById('navAdminBtn'),
    guestControls: document.getElementById('guestControls'),
    userControls: document.getElementById('userControls'),
    navUserRole: document.getElementById('navUserRole'),
    navUserName: document.getElementById('navUserName'),
    openLoginModalBtn: document.getElementById('openLoginModalBtn'),
    openRegisterModalBtn: document.getElementById('openRegisterModalBtn'),
    logoutBtn: document.getElementById('logoutBtn'),

    // Views
    viewCommunity: document.getElementById('viewCommunity'),
    viewMyDashboard: document.getElementById('viewMyDashboard'),
    viewAdminDashboard: document.getElementById('viewAdminDashboard'),

    // Community Hero Stats
    collectiveRoundsCounter: document.getElementById('collectiveRoundsCounter'),
    targetRoundsLabel: document.getElementById('targetRoundsLabel'),
    collectiveProgressBar: document.getElementById('collectiveProgressBar'),
    milestoneTargetSpan: document.getElementById('milestoneTargetSpan'),
    totalDevoteesCount: document.getElementById('totalDevoteesCount'),
    todayRoundsCount: document.getElementById('todayRoundsCount'),
    percentageVal: document.getElementById('percentageVal'),
    avgDailyRounds: document.getElementById('avgDailyRounds'),
    campaignDatesBadge: document.getElementById('campaignDatesBadge'),
    lampCountText: document.getElementById('lampCountText'),
    headerOfferLampBtn: document.getElementById('headerOfferLampBtn'),
    communityLeaderboardBody: document.getElementById('communityLeaderboardBody'),
    leaderboardSearchInput: document.getElementById('leaderboardSearchInput'),
    residenceFilterGroup: document.getElementById('residenceFilterGroup'),

    // Hero FOLK Center Target Elements
    heroCenterTargetCard: document.getElementById('heroCenterTargetCard'),
    heroCenterBadge: document.getElementById('heroCenterBadge'),
    heroCenterUserStatus: document.getElementById('heroCenterUserStatus'),
    heroCenterSwitchGroup: document.getElementById('heroCenterSwitchGroup'),
    heroCenterSubLabel: document.getElementById('heroCenterSubLabel'),
    centerRoundsCounter: document.getElementById('centerRoundsCounter'),
    centerTargetRoundsLabel: document.getElementById('centerTargetRoundsLabel'),
    centerProgressBar: document.getElementById('centerProgressBar'),
    centerPctLabel: document.getElementById('centerPctLabel'),
    centerMilestoneSpan: document.getElementById('centerMilestoneSpan'),
    centerActiveCount: document.getElementById('centerActiveCount'),
    centerTodayCount: document.getElementById('centerTodayCount'),
    centerPctVal: document.getElementById('centerPctVal'),

    // Damodarashtaka Drawer
    toggleDamodarashtakaBtn: document.getElementById('toggleDamodarashtakaBtn'),
    damodarashtakaDrawer: document.getElementById('damodarashtakaDrawer'),
    accordionArrow: document.getElementById('accordionArrow'),
    versesGrid: document.getElementById('versesGrid'),

    // Resident Personal Dashboard
    residentProfileName: document.getElementById('residentProfileName'),
    residentProfileUsername: document.getElementById('residentProfileUsername'),
    residentPersonalGoalVal: document.getElementById('residentPersonalGoalVal'),
    openEditGoalBtn: document.getElementById('openEditGoalBtn'),
    personalProgressBar: document.getElementById('personalProgressBar'),
    personalProgressPctText: document.getElementById('personalProgressPctText'),
    myTotalRounds: document.getElementById('myTotalRounds'),
    myTodayRounds: document.getElementById('myTodayRounds'),
    myStreakCount: document.getElementById('myStreakCount'),
    myContributionPct: document.getElementById('myContributionPct'),
    myTotalSubmissions: document.getElementById('myTotalSubmissions'),
    personalJapaForm: document.getElementById('personalJapaForm'),
    personalChantingDate: document.getElementById('personalChantingDate'),
    personalRoundsInput: document.getElementById('personalRoundsInput'),
    personalNotesInput: document.getElementById('personalNotesInput'),
    myDecRoundsBtn: document.getElementById('myDecRoundsBtn'),
    myIncRoundsBtn: document.getElementById('myIncRoundsBtn'),
    myEntriesTableBody: document.getElementById('myEntriesTableBody'),

    // Admin Dashboard Elements
    adminTotalResidents: document.getElementById('adminTotalResidents'),
    adminActiveResidents: document.getElementById('adminActiveResidents'),
    adminTotalEntries: document.getElementById('adminTotalEntries'),
    adminTotalRounds: document.getElementById('adminTotalRounds'),
    adminExportCsvBtn: document.getElementById('adminExportCsvBtn'),
    adminSettingsForm: document.getElementById('adminSettingsForm'),
    adminCommunityTargetInput: document.getElementById('adminCommunityTargetInput'),
    adminPdeuTargetInput: document.getElementById('adminPdeuTargetInput'),
    adminInfocityTargetInput: document.getElementById('adminInfocityTargetInput'),
    adminStartDateInput: document.getElementById('adminStartDateInput'),
    adminEndDateInput: document.getElementById('adminEndDateInput'),
    adminResidentsTableBody: document.getElementById('adminResidentsTableBody'),
    adminAuditTableBody: document.getElementById('adminAuditTableBody'),
    adminRefreshAuditBtn: document.getElementById('adminRefreshAuditBtn'),

    // Modals
    loginModal: document.getElementById('loginModal'),
    closeLoginModalBtn: document.getElementById('closeLoginModalBtn'),
    loginForm: document.getElementById('loginForm'),
    loginUsername: document.getElementById('loginUsername'),
    loginPassword: document.getElementById('loginPassword'),
    switchToRegisterLink: document.getElementById('switchToRegisterLink'),

    registerModal: document.getElementById('registerModal'),
    closeRegisterModalBtn: document.getElementById('closeRegisterModalBtn'),
    registerForm: document.getElementById('registerForm'),
    registerFullName: document.getElementById('registerFullName'),
    registerResidence: document.getElementById('registerResidence'),
    registerUsername: document.getElementById('registerUsername'),
    registerPassword: document.getElementById('registerPassword'),
    registerGoal: document.getElementById('registerGoal'),
    switchToLoginLink: document.getElementById('switchToLoginLink'),

    forcedPasswordModal: document.getElementById('forcedPasswordModal'),
    forcedPasswordForm: document.getElementById('forcedPasswordForm'),
    forcedCurrentPassword: document.getElementById('forcedCurrentPassword'),
    forcedNewPassword: document.getElementById('forcedNewPassword'),
    forcedConfirmPassword: document.getElementById('forcedConfirmPassword'),

    editEntryModal: document.getElementById('editEntryModal'),
    closeEditEntryModalBtn: document.getElementById('closeEditEntryModalBtn'),
    editEntryForm: document.getElementById('editEntryForm'),
    editEntryId: document.getElementById('editEntryId'),
    editEntryDate: document.getElementById('editEntryDate'),
    editEntryRounds: document.getElementById('editEntryRounds'),
    editEntryNotes: document.getElementById('editEntryNotes'),

    editGoalModal: document.getElementById('editGoalModal'),
    closeEditGoalModalBtn: document.getElementById('closeEditGoalModalBtn'),
    editGoalForm: document.getElementById('editGoalForm'),
    editPersonalGoalInput: document.getElementById('editPersonalGoalInput'),

    lampModal: document.getElementById('lampModal'),
    closeLampModalBtn: document.getElementById('closeLampModalBtn'),
    lampOffererName: document.getElementById('lampOffererName'),
    confirmLampOfferBtn: document.getElementById('confirmLampOfferBtn'),

    toastContainer: document.getElementById('toastContainer')
  };

  /**
   * App Initialization
   */
  async function init() {
    renderDamodarashtakaVerses();
    attachEventListeners();

    const today = new Date().toISOString().split('T')[0];
    if (el.personalChantingDate) {
      el.personalChantingDate.value = today;
      el.personalChantingDate.max = today;
    }

    // 1. Check Auth Status
    await checkAuth();

    // 2. Load Community Stats
    await loadCommunityStats();
  }

  /**
   * Authentication Check
   */
  async function checkAuth() {
    try {
      const data = await apiFetch('/api/auth/me');
      if (data.authenticated && data.user) {
        state.currentUser = data.user;
        if (data.user && data.user.residence && data.user.residence !== 'None' && !state.hasManuallySwitchedCenter) {
          state.selectedHeroCenter = data.user.residence;
        }
        updateAuthHeader();

        // Check if admin is required to change password on first login
        if (state.currentUser.must_change_password) {
          openForcedPasswordModal();
        }
      } else {
        state.currentUser = null;
        updateAuthHeader();
      }
    } catch (e) {
      state.currentUser = null;
      updateAuthHeader();
    }
  }

  /**
   * Update Navigation & Header according to Auth State
   */
  function updateAuthHeader() {
    if (state.currentUser) {
      el.guestControls.style.display = 'none';
      el.userControls.style.display = 'flex';
      el.navMyDashboardBtn.style.display = 'inline-flex';

      el.navUserName.textContent = state.currentUser.full_name.split(' ')[0];
      
      if (state.currentUser.role === 'admin') {
        el.navAdminBtn.style.display = 'inline-flex';
        el.navUserRole.textContent = 'Admin';
        el.navUserRole.className = 'user-role-badge admin-role';
      } else {
        el.navAdminBtn.style.display = 'none';
        el.navUserRole.textContent = 'Resident';
        el.navUserRole.className = 'user-role-badge';
      }
    } else {
      el.guestControls.style.display = 'flex';
      el.userControls.style.display = 'none';
      el.navMyDashboardBtn.style.display = 'none';
      el.navAdminBtn.style.display = 'none';

      if (state.activeView !== 'community') {
        switchView('community');
      }
    }
  }

  /**
   * View Switching
   */
  function switchView(viewName) {
    state.activeView = viewName;

    el.navCommunityBtn.classList.remove('active');
    el.navMyDashboardBtn.classList.remove('active');
    el.navAdminBtn.classList.remove('active');

    el.viewCommunity.style.display = 'none';
    el.viewMyDashboard.style.display = 'none';
    el.viewAdminDashboard.style.display = 'none';

    if (viewName === 'community') {
      el.navCommunityBtn.classList.add('active');
      el.viewCommunity.style.display = 'block';
      loadCommunityStats();
    } else if (viewName === 'my-dashboard') {
      if (!state.currentUser) {
        openLoginModal();
        return;
      }
      el.navMyDashboardBtn.classList.add('active');
      el.viewMyDashboard.style.display = 'block';
      loadResidentDashboard();
    } else if (viewName === 'admin') {
      if (!state.currentUser || state.currentUser.role !== 'admin') {
        showToast('Unauthorized access.');
        switchView('community');
        return;
      }
      el.navAdminBtn.classList.add('active');
      el.viewAdminDashboard.style.display = 'block';
      loadAdminDashboard();
    }
  }

  /**
   * Load Community Stats & Leaderboard
   */
  async function loadCommunityStats() {
    try {
      const stats = await apiFetch('/api/community/stats');
      state.communityStats = stats;

      // Update combined counters & progress
      animateNumber(el.collectiveRoundsCounter, stats.total_rounds);
      el.targetRoundsLabel.textContent = formatNumber(stats.target_rounds);
      el.milestoneTargetSpan.textContent = formatNumber(stats.target_rounds);
      el.collectiveProgressBar.style.width = `${stats.percentage}%`;
      el.percentageVal.textContent = `${stats.percentage}% Achieved`;
      el.todayRoundsCount.textContent = formatNumber(stats.today_rounds);
      el.totalDevoteesCount.textContent = stats.active_participants;
      el.avgDailyRounds.textContent = formatNumber(stats.avg_per_active_devotee);
      el.campaignDatesBadge.textContent = `${formatDateShort(stats.campaign_start_date)} – ${formatDateShort(stats.campaign_end_date)}`;
      el.lampCountText.textContent = `${stats.lamps_offered} Lamps Offered`;

      // Render Boy's FOLK Center Target Card
      renderHeroCenterTarget();

      // Render Leaderboard
      renderLeaderboard(stats.leaderboard);
    } catch (err) {
      console.error('Failed to load community stats:', err);
    }
  }

  /**
   * Render Hero Center Target Card (PDEU / INFOCITY)
   */
  function renderHeroCenterTarget() {
    if (!state.communityStats) return;
    const stats = state.communityStats;

    // Automatically align with logged-in devotee's FOLK residence unless manually switched
    if (state.currentUser && state.currentUser.residence && state.currentUser.residence !== 'None' && !state.hasManuallySwitchedCenter) {
      state.selectedHeroCenter = state.currentUser.residence;
    }

    const isPdeu = state.selectedHeroCenter === 'FOLK PDEU';
    const centerName = isPdeu ? 'FOLK PDEU' : 'FOLK INFOCITY';
    const targetRounds = isPdeu ? (stats.target_pdeu || 5004) : (stats.target_infocity || 5004);
    const currentRounds = isPdeu ? (stats.pdeu_rounds || 0) : (stats.infocity_rounds || 0);
    const pct = isPdeu ? (stats.pdeu_percentage || '0.0') : (stats.infocity_percentage || '0.0');
    const activeChanters = isPdeu ? (stats.pdeu_active || 0) : (stats.infocity_active || 0);
    const todayCenterRounds = isPdeu ? (stats.today_pdeu_rounds || 0) : (stats.today_infocity_rounds || 0);

    // Update center badge & sub-label
    if (el.heroCenterBadge) {
      el.heroCenterBadge.textContent = `${centerName} TARGET`;
    }
    if (el.heroCenterSubLabel) {
      el.heroCenterSubLabel.textContent = `${centerName} Chanting`;
    }

    // Check if viewing the logged-in boy's residence
    const isUserResidence = Boolean(state.currentUser && state.currentUser.residence === centerName);
    if (el.heroCenterTargetCard) {
      if (isUserResidence) {
        el.heroCenterTargetCard.classList.add('is-my-residence');
      } else {
        el.heroCenterTargetCard.classList.remove('is-my-residence');
      }
    }

    if (el.heroCenterUserStatus) {
      if (isUserResidence) {
        el.heroCenterUserStatus.style.display = 'inline-flex';
        el.heroCenterUserStatus.innerHTML = '<svg class="pill-svg star-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Your Residence';
      } else if (state.currentUser && state.currentUser.residence && state.currentUser.residence !== 'None') {
        el.heroCenterUserStatus.style.display = 'inline-flex';
        el.heroCenterUserStatus.textContent = `Center: ${centerName.replace('FOLK ', '')}`;
      } else {
        el.heroCenterUserStatus.style.display = 'inline-flex';
        el.heroCenterUserStatus.textContent = 'Residence Target';
      }
    }

    // Update active switch pill
    if (el.heroCenterSwitchGroup) {
      el.heroCenterSwitchGroup.querySelectorAll('.hero-switch-btn').forEach(btn => {
        if (btn.dataset.center === centerName) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    // Animate & update numbers
    if (el.centerRoundsCounter) animateNumber(el.centerRoundsCounter, currentRounds);
    if (el.centerTargetRoundsLabel) el.centerTargetRoundsLabel.textContent = targetRounds.toLocaleString();
    if (el.centerMilestoneSpan) el.centerMilestoneSpan.textContent = targetRounds.toLocaleString();
    if (el.centerProgressBar) el.centerProgressBar.style.width = `${pct}%`;
    if (el.centerPctLabel) el.centerPctLabel.textContent = `${pct}% Achieved`;
    if (el.centerPctVal) el.centerPctVal.textContent = `${pct}%`;
    if (el.centerActiveCount) el.centerActiveCount.textContent = activeChanters;
    if (el.centerTodayCount) el.centerTodayCount.textContent = todayCenterRounds.toLocaleString();
  }

  /**
   * Render Leaderboard Table
   */
  function renderLeaderboard(list) {
    el.communityLeaderboardBody.innerHTML = '';

    let filtered = list;
    if (state.selectedResidenceFilter && state.selectedResidenceFilter !== 'ALL') {
      filtered = filtered.filter(d => (d.residence || 'FOLK PDEU') === state.selectedResidenceFilter);
    }
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(d => d.full_name.toLowerCase().includes(q) || d.username.toLowerCase().includes(q) || (d.residence || '').toLowerCase().includes(q));
    }

    if (filtered.length === 0) {
      el.communityLeaderboardBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 28px; color: var(--color-oatmilk-muted);">
            No devotee records match the selected residence filter.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach((devotee) => {
      const tr = document.createElement('tr');
      const isRank1 = devotee.rank === 1 && devotee.total_rounds > 0;
      const rankBadge = isRank1 
        ? '<span class="rank-badge rank-1"><svg class="rank-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg> #1</span>' 
        : devotee.rank === 2 
        ? '<span class="rank-badge rank-2"><svg class="rank-svg" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="6"/><path d="M15.4 14.2L17 22l-5-3-5 3 1.6-7.8"/></svg> #2</span>' 
        : devotee.rank === 3 
        ? '<span class="rank-badge rank-3"><svg class="rank-svg" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="6"/><path d="M15.4 14.2L17 22l-5-3-5 3 1.6-7.8"/></svg> #3</span>' 
        : `<span class="rank-badge rank-default">#${devotee.rank}</span>`;
      const lastOfferingStr = devotee.last_chanted_date ? formatDate(devotee.last_chanted_date) : 'Pending';
      const residenceTagClass = (devotee.residence === 'FOLK INFOCITY') ? 'infocity' : (devotee.residence === 'FOLK PDEU' ? 'pdeu' : 'none');
      const isMyRow = Boolean(state.currentUser && state.currentUser.id === devotee.user_id);
      const youBadge = isMyRow ? ' <span style="font-size: 0.72rem; color: var(--color-orange-light); font-weight: 700; margin-left: 4px;">(You)</span>' : '';

      if (isMyRow) {
        tr.style.background = 'rgba(233, 99, 26, 0.1)';
      }

      tr.innerHTML = `
        <td>${rankBadge}</td>
        <td><strong>${escapeHTML(devotee.full_name)}</strong>${youBadge}</td>
        <td><span class="residence-tag ${residenceTagClass}">${escapeHTML(devotee.residence || 'FOLK PDEU')}</span></td>
        <td><span class="streak-pill ${devotee.streak > 0 ? 'active' : ''}"><svg class="icon-svg flame-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.5 6 6 9.5 6 13a6 6 0 0 0 12 0c0-3.5-2.5-7-6-11zm0 15a3 3 0 0 1-3-3c0-1.5 1-3 3-5 2 2 3 3.5 3 5a3 3 0 0 1-3 3z"/></svg> ${devotee.streak || 0} ${devotee.streak === 1 ? 'day' : 'days'}</span></td>
        <td style="color: var(--color-oatmilk-muted);">@${escapeHTML(devotee.username)}</td>
        <td style="text-align: right; font-weight: 700; color: var(--color-orange-light); font-size: 1.05rem;">
          ${devotee.total_rounds.toLocaleString()}
        </td>
        <td style="text-align: center;">${devotee.active_days} days</td>
        <td style="text-align: right; color: var(--color-gold);">${devotee.contribution_pct}%</td>
        <td style="color: var(--color-oatmilk-muted); font-size: 0.8rem;">${lastOfferingStr}</td>
      `;

      el.communityLeaderboardBody.appendChild(tr);
    });
  }

  /**
   * Load Individual Resident Dashboard
   */
  async function loadResidentDashboard() {
    try {
      const data = await apiFetch('/api/user/dashboard');
      state.userDashboard = data;

      // Profile & Goals
      el.residentProfileName.textContent = data.profile.full_name;
      el.residentProfileUsername.textContent = `${data.profile.username} • ${data.profile.residence || 'FOLK PDEU'}`;
      el.residentPersonalGoalVal.textContent = data.profile.personal_goal.toLocaleString();
      el.personalProgressBar.style.width = `${data.stats.personal_progress_pct}%`;
      el.personalProgressPctText.textContent = `${data.stats.personal_progress_pct}% of ${data.profile.personal_goal.toLocaleString()} target rounds completed`;

      // Stat cards
      el.myTotalRounds.textContent = data.stats.total_rounds.toLocaleString();
      el.myTodayRounds.textContent = data.stats.today_rounds.toLocaleString();
      if (el.myStreakCount) {
        const streak = data.stats.current_streak || 0;
        el.myStreakCount.innerHTML = `<svg class="icon-svg flame-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.5 6 6 9.5 6 13a6 6 0 0 0 12 0c0-3.5-2.5-7-6-11zm0 15a3 3 0 0 1-3-3c0-1.5 1-3 3-5 2 2 3 3.5 3 5a3 3 0 0 1-3 3z"/></svg> ${streak} ${streak === 1 ? 'Day' : 'Days'}`;
      }
      el.myContributionPct.textContent = `${data.stats.contribution_pct}%`;
      el.myTotalSubmissions.textContent = data.stats.total_entries_logged;

      // Render Entries
      renderMyEntries(data.entries);
    } catch (err) {
      showToast('Could not load your personal chanting records.');
    }
  }

  /**
   * Render Personal Submissions History
   */
  function renderMyEntries(entries) {
    el.myEntriesTableBody.innerHTML = '';

    if (!entries || entries.length === 0) {
      el.myEntriesTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 24px; color: var(--color-oatmilk-muted);">
            No chanting submissions logged yet. Record your daily rounds above!
          </td>
        </tr>
      `;
      return;
    }

    entries.forEach(item => {
      const tr = document.createElement('tr');
      const timeAgo = formatTimeAgo(new Date(item.created_at).getTime());

      tr.innerHTML = `
        <td><strong>${formatDate(item.date)}</strong></td>
        <td><strong style="color: var(--color-orange-light); font-size: 1.05rem;">+${item.rounds}</strong></td>
        <td style="color: var(--color-oatmilk-muted); font-size: 0.82rem;">${escapeHTML(item.notes || '—')}</td>
        <td style="color: var(--color-oatmilk-subtle); font-size: 0.78rem;">${timeAgo}</td>
        <td>
          <button class="btn-action-edit" data-id="${item.id}" data-date="${item.date}" data-rounds="${item.rounds}" data-notes="${escapeHTML(item.notes || '')}">Edit</button>
          <button class="btn-action-del" data-id="${item.id}">Delete</button>
        </td>
      `;

      el.myEntriesTableBody.appendChild(tr);
    });
  }

  /**
   * Load Admin Dashboard
   */
  async function loadAdminDashboard() {
    try {
      const [overview, residents, settings, audit] = await Promise.all([
        apiFetch('/api/admin/overview'),
        apiFetch('/api/admin/residents'),
        apiFetch('/api/community/stats'),
        apiFetch('/api/admin/audit-logs')
      ]);

      // Metrics
      el.adminTotalResidents.textContent = overview.total_residents;
      el.adminActiveResidents.textContent = overview.active_residents;
      el.adminTotalEntries.textContent = overview.total_entries;
      el.adminTotalRounds.textContent = overview.total_rounds.toLocaleString();

      // Settings inputs
      el.adminCommunityTargetInput.value = settings.target_rounds;
      if (el.adminPdeuTargetInput) el.adminPdeuTargetInput.value = settings.target_pdeu || 5004;
      if (el.adminInfocityTargetInput) el.adminInfocityTargetInput.value = settings.target_infocity || 5004;
      el.adminStartDateInput.value = settings.campaign_start_date;
      el.adminEndDateInput.value = settings.campaign_end_date;

      // Render Residents
      renderAdminResidents(residents.residents);

      // Render Audit Log
      renderAdminAudit(audit.logs);
    } catch (err) {
      showToast('Could not load administrative data.');
    }
  }

  function renderAdminResidents(residents) {
    el.adminResidentsTableBody.innerHTML = '';

    residents.forEach(r => {
      const tr = document.createElement('tr');
      const statusClass = r.is_active ? 'status-active' : 'status-deactivated';
      const statusLabel = r.is_active ? 'Active' : 'Deactivated';
      const toggleActionLabel = r.is_active ? 'Deactivate' : 'Activate';

      const residenceTagClass = (r.residence === 'FOLK INFOCITY') ? 'infocity' : 'pdeu';

      tr.innerHTML = `
        <td><strong>${escapeHTML(r.full_name)}</strong></td>
        <td style="color: var(--color-oatmilk-muted);">@${escapeHTML(r.username)}</td>
        <td><span class="residence-tag ${residenceTagClass}">${escapeHTML(r.residence || 'FOLK PDEU')}</span></td>
        <td><span class="streak-pill ${r.streak > 0 ? 'active' : ''}"><svg class="flame-svg" viewBox="0 0 24 24"><path d="M12 23c-4.97 0-9-4.03-9-9 0-4.17 2.84-7.67 6.69-8.69L10 5l.31.25C11.53 6.25 12 7.78 12 9c1.5-2 3.5-3.5 5.5-4.5l.5.85C16.8 7.35 16 9.5 16 12c2 0 3-1 3-1s1 2.5 0 5c1 0 2-1 2-1 .5 2-1 8-9 8z"/></svg> ${r.streak || 0}d</span></td>
        <td style="color: var(--color-orange-light); font-weight: 700;">${r.total_rounds.toLocaleString()}</td>
        <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
        <td>
          <button class="btn-micro admin-toggle-user-btn" data-id="${r.id}">
            ${toggleActionLabel}
          </button>
        </td>
      `;

      el.adminResidentsTableBody.appendChild(tr);
    });
  }

  function renderAdminAudit(logs) {
    el.adminAuditTableBody.innerHTML = '';

    logs.forEach(l => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-size: 0.78rem; color: var(--color-oatmilk-muted); white-space: nowrap;">${formatDateTime(l.created_at)}</td>
        <td><strong>${escapeHTML(l.actor_name)}</strong></td>
        <td><span class="status-badge" style="background: rgba(233,99,26,0.2); color: var(--color-orange-light);">${escapeHTML(l.action)}</span></td>
        <td style="font-size: 0.8rem;">${escapeHTML(l.target_type || '')} (${escapeHTML(l.target_id || '')})</td>
        <td style="font-size: 0.82rem; color: var(--color-oatmilk);">${escapeHTML(l.details)}</td>
      `;
      el.adminAuditTableBody.appendChild(tr);
    });
  }

  /**
   * Event Listeners Registration
   */
  function attachEventListeners() {
    // Nav Tabs
    el.navCommunityBtn.addEventListener('click', () => switchView('community'));
    el.navMyDashboardBtn.addEventListener('click', () => switchView('my-dashboard'));
    el.navAdminBtn.addEventListener('click', () => switchView('admin'));

    // Auth Modal Triggers
    el.openLoginModalBtn.addEventListener('click', openLoginModal);
    el.closeLoginModalBtn.addEventListener('click', closeLoginModal);
    el.loginModal.addEventListener('click', (e) => { if (e.target === el.loginModal) closeLoginModal(); });

    el.openRegisterModalBtn.addEventListener('click', openRegisterModal);
    el.closeRegisterModalBtn.addEventListener('click', closeRegisterModal);
    el.registerModal.addEventListener('click', (e) => { if (e.target === el.registerModal) closeRegisterModal(); });

    el.switchToRegisterLink.addEventListener('click', (e) => {
      e.preventDefault();
      closeLoginModal();
      openRegisterModal();
    });

    el.switchToLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      closeRegisterModal();
      openLoginModal();
    });

    // Login Form Submit
    el.loginForm.addEventListener('submit', handleLogin);

    // Register Form Submit
    el.registerForm.addEventListener('submit', handleRegister);

    // Logout
    el.logoutBtn.addEventListener('click', handleLogout);

    // Forced Password Change Form
    el.forcedPasswordForm.addEventListener('submit', handleForcedPasswordChange);

    // Leaderboard Search & Residence Filter
    el.leaderboardSearchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (state.communityStats) {
        renderLeaderboard(state.communityStats.leaderboard);
      }
    });

    if (el.residenceFilterGroup) {
      el.residenceFilterGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-pill');
        if (btn) {
          state.selectedResidenceFilter = btn.dataset.residence;
          el.residenceFilterGroup.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
          btn.classList.add('active');
          if (state.communityStats) {
            renderLeaderboard(state.communityStats.leaderboard);
          }
        }
      });
    }

    // Hero FOLK Center Target Switcher (FOLK PDEU / FOLK INFOCITY)
    if (el.heroCenterSwitchGroup) {
      el.heroCenterSwitchGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.hero-switch-btn');
        if (btn) {
          state.selectedHeroCenter = btn.dataset.center;
          state.hasManuallySwitchedCenter = true;
          renderHeroCenterTarget();
        }
      });
    }

    // Deepam / Lamp Offerings
    el.headerOfferLampBtn.addEventListener('click', openLampModal);
    el.closeLampModalBtn.addEventListener('click', closeLampModal);
    el.lampModal.addEventListener('click', (e) => { if (e.target === el.lampModal) closeLampModal(); });
    el.confirmLampOfferBtn.addEventListener('click', handleOfferLamp);

    // Damodarashtaka Drawer Toggle
    el.toggleDamodarashtakaBtn.addEventListener('click', () => {
      const isHidden = el.damodarashtakaDrawer.style.display === 'none';
      el.damodarashtakaDrawer.style.display = isHidden ? 'block' : 'none';
      el.accordionArrow.textContent = isHidden ? '▲' : '▼';
    });

    // Personal Japa Form Steppers & Quick Pills
    el.myDecRoundsBtn.addEventListener('click', () => {
      let val = parseInt(el.personalRoundsInput.value, 10) || 1;
      if (val > 1) {
        el.personalRoundsInput.value = val - 1;
        updatePersonalQuickPills();
      }
    });

    el.myIncRoundsBtn.addEventListener('click', () => {
      let val = parseInt(el.personalRoundsInput.value, 10) || 0;
      el.personalRoundsInput.value = val + 1;
      updatePersonalQuickPills();
    });

    document.querySelectorAll('.quick-pill[data-myrounds]').forEach(pill => {
      pill.addEventListener('click', () => {
        el.personalRoundsInput.value = pill.dataset.myrounds;
        updatePersonalQuickPills();
      });
    });

    el.personalRoundsInput.addEventListener('input', updatePersonalQuickPills);

    // Submit Personal Japa
    el.personalJapaForm.addEventListener('submit', handlePersonalJapaSubmit);

    // Personal Entries Table (Edit & Delete Delegation)
    el.myEntriesTableBody.addEventListener('click', handleEntryAction);

    // Edit Entry Modal
    el.closeEditEntryModalBtn.addEventListener('click', closeEditEntryModal);
    el.editEntryModal.addEventListener('click', (e) => { if (e.target === el.editEntryModal) closeEditEntryModal(); });
    el.editEntryForm.addEventListener('submit', handleSaveEntryCorrection);

    // Edit Goal Modal
    el.openEditGoalBtn.addEventListener('click', () => {
      if (state.currentUser) {
        el.editPersonalGoalInput.value = state.currentUser.personal_goal || 496;
        el.editGoalModal.style.display = 'flex';
      }
    });
    el.closeEditGoalModalBtn.addEventListener('click', () => el.editGoalModal.style.display = 'none');
    el.editGoalModal.addEventListener('click', (e) => { if (e.target === el.editGoalModal) el.editGoalModal.style.display = 'none'; });
    el.editGoalForm.addEventListener('submit', handleSaveGoal);

    // Admin Tools
    el.adminSettingsForm.addEventListener('submit', handleAdminSettingsSave);
    el.adminExportCsvBtn.addEventListener('click', () => {
      window.location.href = '/api/admin/export-csv';
    });
    el.adminRefreshAuditBtn.addEventListener('click', async () => {
      const audit = await apiFetch('/api/admin/audit-logs');
      renderAdminAudit(audit.logs);
      showToast('Audit trail refreshed.');
    });

    // Admin Toggle User Status Delegation
    el.adminResidentsTableBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('.admin-toggle-user-btn');
      if (btn) {
        const id = btn.dataset.id;
        try {
          const res = await apiFetch(`/api/admin/residents/${id}/toggle-status`, { method: 'POST' });
          showToast(res.message);
          loadAdminDashboard();
        } catch (err) {
          showToast(err.message);
        }
      }
    });
  }

  /**
   * Auth Handlers
   */
  async function handleLogin(e) {
    e.preventDefault();
    const username = el.loginUsername.value.trim();
    const password = el.loginPassword.value;

    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      state.currentUser = data.user;
      state.token = data.token;
      state.hasManuallySwitchedCenter = false;
      if (data.user && data.user.residence && data.user.residence !== 'None') {
        state.selectedHeroCenter = data.user.residence;
      }
      localStorage.setItem('folk_jwt_token', data.token);

      closeLoginModal();
      el.loginForm.reset();
      updateAuthHeader();
      renderHeroCenterTarget();

      showToast(`Haribol, welcome back ${data.user.full_name}!`);

      if (data.user.must_change_password) {
        openForcedPasswordModal();
      } else {
        switchView('my-dashboard');
      }
    } catch (err) {
      showToast(err.message);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    const full_name = el.registerFullName.value.trim();
    const residence = el.registerResidence ? el.registerResidence.value : 'FOLK PDEU';
    const username = el.registerUsername.value.trim();
    const password = el.registerPassword.value;
    const personal_goal = parseInt(el.registerGoal.value, 10) || 496;

    try {
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ full_name, residence, username, password, personal_goal })
      });

      state.currentUser = data.user;
      state.token = data.token;
      state.hasManuallySwitchedCenter = false;
      if (data.user && data.user.residence && data.user.residence !== 'None') {
        state.selectedHeroCenter = data.user.residence;
      }
      localStorage.setItem('folk_jwt_token', data.token);

      closeRegisterModal();
      el.registerForm.reset();
      updateAuthHeader();
      renderHeroCenterTarget();

      showToast(`Welcome devotee ${data.user.full_name} to Damodar Month 2026!`);
      switchView('my-dashboard');
    } catch (err) {
      showToast(err.message);
    }
  }

  async function handleLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}

    state.currentUser = null;
    state.token = null;
    state.hasManuallySwitchedCenter = false;
    localStorage.removeItem('folk_jwt_token');
    updateAuthHeader();
    renderHeroCenterTarget();
    switchView('community');
    showToast('Successfully signed out.');
  }

  async function handleForcedPasswordChange(e) {
    e.preventDefault();
    const current_password = el.forcedCurrentPassword.value;
    const new_password = el.forcedNewPassword.value;
    const confirm = el.forcedConfirmPassword.value;

    if (new_password !== confirm) {
      showToast('New passwords do not match.');
      return;
    }

    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password, new_password })
      });

      state.currentUser.must_change_password = false;
      el.forcedPasswordModal.style.display = 'none';
      showToast('Administrator password updated successfully.');
      switchView('admin');
    } catch (err) {
      showToast(err.message);
    }
  }

  /**
   * Submit Daily Japa
   */
  async function handlePersonalJapaSubmit(e) {
    e.preventDefault();
    const date = el.personalChantingDate.value;
    const rounds = parseInt(el.personalRoundsInput.value, 10);
    const notes = el.personalNotesInput.value;

    try {
      const data = await apiFetch('/api/user/entries', {
        method: 'POST',
        body: JSON.stringify({ date, rounds, notes })
      });

      showToast(`${rounds} rounds offered to Lord Damodar!`);
      el.personalNotesInput.value = '';
      el.personalRoundsInput.value = 16;
      updatePersonalQuickPills();

      await loadResidentDashboard();
      await loadCommunityStats();
    } catch (err) {
      showToast(err.message);
    }
  }

  /**
   * Entry Edit & Delete
   */
  function handleEntryAction(e) {
    const editBtn = e.target.closest('.btn-action-edit');
    const delBtn = e.target.closest('.btn-action-del');

    if (editBtn) {
      el.editEntryId.value = editBtn.dataset.id;
      el.editEntryDate.value = editBtn.dataset.date;
      el.editEntryRounds.value = editBtn.dataset.rounds;
      el.editEntryNotes.value = editBtn.dataset.notes;
      el.editEntryModal.style.display = 'flex';
    } else if (delBtn) {
      const id = delBtn.dataset.id;
      if (confirm('Delete this chanting record from your history?')) {
        deletePersonalEntry(id);
      }
    }
  }

  async function deletePersonalEntry(id) {
    try {
      await apiFetch(`/api/user/entries/${id}`, { method: 'DELETE' });
      showToast('Record deleted.');
      loadResidentDashboard();
      loadCommunityStats();
    } catch (err) {
      showToast(err.message);
    }
  }

  async function handleSaveEntryCorrection(e) {
    e.preventDefault();
    const id = el.editEntryId.value;
    const date = el.editEntryDate.value;
    const rounds = parseInt(el.editEntryRounds.value, 10);
    const notes = el.editEntryNotes.value;

    try {
      await apiFetch(`/api/user/entries/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ date, rounds, notes })
      });

      closeEditEntryModal();
      showToast('Record updated successfully.');
      loadResidentDashboard();
      loadCommunityStats();
    } catch (err) {
      showToast(err.message);
    }
  }

  async function handleSaveGoal(e) {
    e.preventDefault();
    const personal_goal = parseInt(el.editPersonalGoalInput.value, 10);

    try {
      const data = await apiFetch('/api/user/profile', {
        method: 'POST',
        body: JSON.stringify({ personal_goal })
      });

      state.currentUser.personal_goal = data.personal_goal;
      el.editGoalModal.style.display = 'none';
      showToast('Personal goal updated.');
      loadResidentDashboard();
    } catch (err) {
      showToast(err.message);
    }
  }

  /**
   * Deepam Offering
   */
  async function handleOfferLamp() {
    const devotee_name = el.lampOffererName.value.trim() || (state.currentUser ? state.currentUser.full_name : 'A Devotee');
    try {
      const res = await apiFetch('/api/lamps/offer', {
        method: 'POST',
        body: JSON.stringify({ devotee_name })
      });

      closeLampModal();
      el.lampCountText.textContent = `${res.lamps_offered} Lamps Offered`;
      showToast(`Deepam offered by ${res.devotee_name} to Sri Yashoda Damodar!`);
    } catch (e) {
      showToast('Could not record lamp offering.');
    }
  }

  /**
   * Admin Settings Save
   */
  async function handleAdminSettingsSave(e) {
    e.preventDefault();
    const community_target = el.adminCommunityTargetInput.value;
    const target_folk_pdeu = el.adminPdeuTargetInput ? el.adminPdeuTargetInput.value : null;
    const target_folk_infocity = el.adminInfocityTargetInput ? el.adminInfocityTargetInput.value : null;
    const campaign_start_date = el.adminStartDateInput.value;
    const campaign_end_date = el.adminEndDateInput.value;

    try {
      await apiFetch('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({ community_target, target_folk_pdeu, target_folk_infocity, campaign_start_date, campaign_end_date })
      });

      showToast('Campaign & residence targets saved successfully.');
      await loadCommunityStats();
    } catch (err) {
      showToast(err.message);
    }
  }

  /**
   * Modal Controllers
   */
  function openLoginModal() {
    el.loginModal.style.display = 'flex';
    el.loginUsername.focus();
  }
  function closeLoginModal() { el.loginModal.style.display = 'none'; }

  function openRegisterModal() {
    el.registerModal.style.display = 'flex';
    el.registerFullName.focus();
  }
  function closeRegisterModal() { el.registerModal.style.display = 'none'; }

  function openForcedPasswordModal() {
    el.forcedPasswordModal.style.display = 'flex';
    el.forcedCurrentPassword.focus();
  }

  function closeEditEntryModal() { el.editEntryModal.style.display = 'none'; }

  function openLampModal() {
    if (state.currentUser) {
      el.lampOffererName.value = state.currentUser.full_name;
    }
    el.lampModal.style.display = 'flex';
  }
  function closeLampModal() { el.lampModal.style.display = 'none'; }

  function updatePersonalQuickPills() {
    const val = parseInt(el.personalRoundsInput.value, 10);
    document.querySelectorAll('.quick-pill[data-myrounds]').forEach(p => {
      if (parseInt(p.dataset.myrounds, 10) === val) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });
  }

  function renderDamodarashtakaVerses() {
    el.versesGrid.innerHTML = '';
    DAMODARASHTAKA_VERSES.forEach(verse => {
      const div = document.createElement('div');
      div.className = 'verse-item';
      div.innerHTML = `
        <span class="verse-num">Verse ${verse.num}</span>
        <p class="verse-sanskrit">${escapeHTML(verse.sanskrit)}</p>
        <p class="verse-trans">${escapeHTML(verse.trans)}</p>
      `;
      el.versesGrid.appendChild(div);
    });
  }

  /**
   * Helper Utilities
   */
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 4000);
  }

  function formatNumber(value) {
    const numericValue = Number(value);
    return (Number.isFinite(numericValue) ? numericValue : 0).toLocaleString();
  }

  function animateNumber(element, finalValue) {
    if (!element) return;
    finalValue = Number(finalValue);
    if (!Number.isFinite(finalValue)) finalValue = 0;
    const startValue = parseInt(element.textContent.replace(/,/g, ''), 10) || 0;
    if (startValue === finalValue) return;

    const duration = 500;
    const startTime = performance.now();

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(startValue + (finalValue - startValue) * ease);
      element.textContent = formatNumber(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        element.textContent = formatNumber(finalValue);
      }
    }
    requestAnimationFrame(step);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    } catch (e) {}
    return dateStr;
  }

  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch (e) {}
    return dateStr;
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {}
    return isoStr;
  }

  function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
