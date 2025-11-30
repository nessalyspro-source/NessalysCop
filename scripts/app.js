document.addEventListener('DOMContentLoaded', () => {
    // --- DATA (Simulated Database) ---
    // Datasources emptied to connect later to Supabase
    const contractsData = {};
    const clientsData = {};
    const reportsData = {};
    const employees = [];
    const employeesData = {};

    // --- STATE ---
    let currentContractId = null;
    let editingContractId = null;
    let editingClientId = null;
    let currentAssignedEmployeeId = 1;
    let signaturePad;
    let clientStep = 1;
    let clientType = null;
    let contractStep = 1;
    let contractContacts = [];
    let currentReportId = null;
    let reportAttendees = [];
    let reportSections = [];
    let reportStep = 1;
    let societeRef = null;
    let toastTimeout;
    const SUPABASE_URL = 'https://wirwhmoxndqvlopzvgtf.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpcndobW94bmRxdmxvcHp2Z3RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NDMzNjksImV4cCI6MjA4MDAxOTM2OX0.Xp0PuJkglDYoWDq39_d6TuYdDX6ktJ9iJ1TSP2yT5Yc';
    const SOCIETE_BUCKET = 'societe-assets';
    const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

    // --- GENERAL UI FUNCTIONS ---
    const toggleSidebar = () => {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('mobile-sidebar-backdrop');
        sidebar.classList.toggle('-translate-x-full');
        backdrop.classList.toggle('hidden');
    };

    const closeSidebarOnMobile = () => {
        if (window.innerWidth < 1024 && !document.getElementById('sidebar').classList.contains('-translate-x-full')) {
            toggleSidebar();
        }
    };

    const switchView = (viewId, element) => {
        ['view-dashboard', 'view-clients', 'view-contrats', 'view-signalements', 'view-rapports', 'view-employes'].forEach(id => {
            document.getElementById(id)?.classList.add('hidden');
        });
        document.getElementById('view-' + viewId)?.classList.remove('hidden');
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active', 'bg-white', 'text-sidebar-accent', 'shadow-sm'));
        const navElement = element || document.getElementById('nav-' + viewId);
        navElement?.classList.add('active', 'bg-white', 'text-sidebar-accent', 'shadow-sm');
    };

    const showToast = (msg) => {
        const toast = document.getElementById('toast');
        if(!toast) return;
        toast.innerHTML = `<i class="fa-solid fa-check text-green-400"></i> ${msg}`;
        toast.classList.remove('hidden');
        toast.classList.remove('toast-active');
        // force reflow to restart animation
        void toast.offsetWidth;
        toast.classList.add('toast-active');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('toast-active');
            toast.classList.add('hidden');
        }, 3000);
    };

    const openModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (!modal) { console.error(`Modal with ID "${modalId}" not found.`); return; }
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.querySelector('.absolute.inset-0')?.classList.remove('opacity-0');
            modal.querySelector('.pointer-events-auto')?.classList.remove('translate-x-full');
        }, 10);
    };

    const closeModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.querySelector('.absolute.inset-0')?.classList.add('opacity-0');
        modal.querySelector('.pointer-events-auto')?.classList.add('translate-x-full');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };

    // --- SUPABASE HELPERS ---
    const normalizeSiret = (value = '') => value.replace(/\D/g, '');

    const attachSocieteLogoPreview = (inputId, previewId) => {
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        if (!input || !preview) return;
        input.addEventListener('change', () => {
            const file = input.files?.[0];
            if (!file) {
                preview.style.backgroundImage = '';
                preview.textContent = 'Logo';
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                preview.style.backgroundImage = `url('${reader.result}')`;
                preview.style.backgroundSize = 'cover';
                preview.style.backgroundPosition = 'center';
                preview.textContent = '';
            };
            reader.readAsDataURL(file);
        });
    };

    const uploadSocieteLogo = async (file, reference) => {
        if (!file || !supabaseClient) return { path: null, url: null };
        const safeRef = reference || `SCT-${Date.now()}`;
        const extension = (file.name.split('.').pop() || 'png').toLowerCase();
        const path = `logos/${safeRef}/${Date.now()}.${extension}`;
        const { error } = await supabaseClient.storage.from(SOCIETE_BUCKET).upload(path, file, {
            cacheControl: '3600',
            upsert: true
        });
        if (error) throw new Error(`Upload du logo impossible : ${error.message}`);
        const { data } = supabaseClient.storage.from(SOCIETE_BUCKET).getPublicUrl(path);
        return { path, url: data?.publicUrl || null };
    };

    const upsertTrialLimits = async (societeId, trialEnabled) => {
        if (!supabaseClient || !societeId) return;
        const payload = {
            societe_id: societeId,
            clients_limit: trialEnabled ? 2 : null,
            contracts_limit: trialEnabled ? 5 : null,
            employees_limit: trialEnabled ? 5 : null
        };
        const { error } = await supabaseClient.from('societe_limits').upsert(payload, { onConflict: 'societe_id' });
        if (error) throw new Error(`Impossible de définir les limites : ${error.message}`);
    };

    const collectSocieteFormData = () => {
        const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
        const reference = getVal('societe-ref');
        const rawSiret = getVal('societe-siret');
        const normalizedSiret = normalizeSiret(rawSiret);
        const trialEnabled = document.getElementById('essaie-30')?.checked || false;
        const now = new Date();
        const contact = {
            role_label: getVal('contact-statut'),
            first_name: getVal('contact-prenom'),
            last_name: getVal('contact-nom'),
            email: getVal('contact-email'),
            phone: getVal('contact-tel')
        };
        const hasContact = Object.values(contact).some(Boolean);
        return {
            reference,
            name: getVal('societe-nom'),
            logoFile: document.getElementById('societe-logo-file')?.files?.[0] || null,
            siret: normalizedSiret,
            address: getVal('societe-adresse'),
            email: getVal('societe-email'),
            phone: getVal('societe-tel'),
            type: document.getElementById('societe-type')?.value || '',
            remisePercent: parseFloat(getVal('remise-pct')) || null,
            remiseMois: parseInt(getVal('remise-mois'), 10) || null,
            trialEnabled,
            trialStartedAt: trialEnabled ? now.toISOString() : null,
            trialExpiresAt: trialEnabled ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
            contact: hasContact ? contact : null
        };
    };

    const setSocieteModalLoading = (isLoading) => {
        const btn = document.querySelector('[data-action="save-societe"]');
        if (!btn) return;
        btn.disabled = isLoading;
        btn.classList.toggle('opacity-60', isLoading);
        btn.innerHTML = isLoading ? '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Enregistrement...' : 'Enregistrer';
    };

    const handleSocieteSave = async () => {
        if (!supabaseClient) {
            showToast('Supabase non initialisé');
            return;
        }
        const formData = collectSocieteFormData();
        if (!formData.name) {
            showToast('Le nom de la société est requis');
            return;
        }
        if (formData.siret.length !== 14) {
            showToast('Le SIRET doit contenir 14 chiffres');
            return;
        }
        setSocieteModalLoading(true);
        try {
            const logoInfo = await uploadSocieteLogo(formData.logoFile, formData.reference);
            const insertPayload = {
                ref: formData.reference,
                name: formData.name,
                siret: formData.siret,
                address_line1: formData.address || null,
                email: formData.email || null,
                phone: formData.phone || null,
                type_activite: formData.type || null,
                remise_percent: formData.remisePercent,
                remise_mois: formData.remiseMois,
                trial_enabled: formData.trialEnabled,
                trial_started_at: formData.trialStartedAt,
                trial_expires_at: formData.trialExpiresAt,
                base_price_ht: 29.99,
                logo_storage_path: logoInfo.path,
                logo_public_url: logoInfo.url
            };
            const { data: createdSociete, error } = await supabaseClient.from('societes').insert([insertPayload]).select().single();
            if (error) throw error;
            if (formData.contact) {
                await supabaseClient.from('societe_contacts').insert([{ ...formData.contact, societe_id: createdSociete.id }]);
            }
            await upsertTrialLimits(createdSociete.id, formData.trialEnabled);
            showToast('Société créée');
            closeSocieteModal();
        } catch (error) {
            console.error('Erreur création société', error);
            showToast(error.message || 'Erreur lors de la création');
        } finally {
            setSocieteModalLoading(false);
        }
    };

    // --- REPORT MODAL (Rapport) ---
    const renderReportAttendees = () => {
        const container = document.getElementById('report-attendees-container');
        if (!container) return;
        if (!reportAttendees.length) {
            container.innerHTML = '<p class="text-sm text-gray-400">Aucun participant ajouté.</p>';
            return;
        }
        const items = reportAttendees.map((att, idx) => {
            const initials = (att.name || '?')
                .split(' ')
                .filter(Boolean)
                .map(word => word[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
            return `
                <div class="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-full bg-sidebar-bg text-sidebar-dark flex items-center justify-center font-bold text-xs">${initials}</div>
                        <div>
                            <p class="text-sm font-semibold text-sidebar-dark">${att.name || '-'}</p>
                            <p class="text-xs text-gray-500">${att.role || ''}</p>
                        </div>
                    </div>
                    <button data-action="remove-report-attendee" data-index="${idx}" class="text-xs font-semibold text-red-500 hover:text-red-600">Retirer</button>
                </div>
            `;
        }).join('');
        container.innerHTML = items;
    };

    const renderReportSections = () => {
        const list = document.getElementById('report-sections-list');
        if (!list) return;
        if (!reportSections.length) {
            list.innerHTML = '<p class="text-sm text-gray-400">Aucune section ajoutée.</p>';
            return;
        }
        list.innerHTML = reportSections.map((sec, idx) => `
            <div class="bg-white border border-gray-100 rounded-2xl p-4 space-y-2">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-semibold text-sidebar-dark">${sec.title || 'Section'}</p>
                        <p class="text-xs text-gray-500">${sec.action || ''}</p>
                    </div>
                    <button data-action="remove-report-section" data-index="${idx}" class="text-xs font-semibold text-red-500 hover:text-red-600">Supprimer</button>
                </div>
                <p class="text-sm text-gray-600 leading-relaxed">${sec.desc || ''}</p>
                ${sec.photos?.length ? `<div class="flex gap-2 flex-wrap">${sec.photos.map(src => `<span class="text-[10px] bg-gray-100 px-2 py-1 rounded">${src}</span>`).join('')}</div>` : ''}
            </div>
        `).join('');
    };

    const renderReportRecap = () => {
        const recap = document.getElementById('signatures-list');
        if (!recap) return;
        const site = document.getElementById('report-contract-select')?.selectedOptions?.[0]?.text || '-';
        const date = document.getElementById('report-date')?.value || '-';
        const time = document.getElementById('report-start-time')?.value || '-';
        const attendeesHtml = reportAttendees.length
            ? reportAttendees.map(a => `<li class="text-sm text-gray-700">${a.name} (${a.role || 'Invite'})</li>`).join('')
            : '<li class="text-sm text-gray-400">Aucun participant</li>';
        const sectionsHtml = reportSections.length
            ? reportSections.map((s, i) => `<li class="text-sm text-gray-700">${i + 1}. ${s.title || 'Section'} - ${s.action || ''}</li>`).join('')
            : '<li class="text-sm text-gray-400">Aucune section</li>';
        recap.innerHTML = `
            <div class="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
                <p class="text-xs uppercase text-gray-400 font-semibold">Synthese</p>
                <p class="text-sm text-gray-700"><strong>Site:</strong> ${site}</p>
                <p class="text-sm text-gray-700"><strong>Date:</strong> ${date} a ${time}</p>
                <div>
                    <p class="text-xs uppercase text-gray-400 font-semibold mb-1">Participants</p>
                    <ul class="space-y-1">${attendeesHtml}</ul>
                </div>
                <div>
                    <p class="text-xs uppercase text-gray-400 font-semibold mb-1">Sections</p>
                    <ul class="space-y-1">${sectionsHtml}</ul>
                </div>
            </div>
        `;
    };

    const updateReportStepView = () => {
        document.getElementById('r-step-content-1')?.classList.toggle('hidden', reportStep !== 1);
        document.getElementById('r-step-content-2')?.classList.toggle('hidden', reportStep !== 2);
        document.getElementById('r-step-content-3')?.classList.toggle('hidden', reportStep !== 3);

        const dots = [
            document.getElementById('r-step-dot-1'),
            document.getElementById('r-step-dot-2'),
            document.getElementById('r-step-dot-3')
        ];
        dots.forEach((dot, idx) => {
            if (!dot) return;
            const active = (idx + 1) <= reportStep;
            dot.classList.toggle('bg-sidebar-accent', active);
            dot.classList.toggle('text-white', active);
            dot.classList.toggle('bg-gray-200', !active);
            dot.classList.toggle('text-gray-400', !active);
        });

        const prog1 = document.getElementById('r-progress-1');
        const prog2 = document.getElementById('r-progress-2');
        if (prog1) prog1.style.width = reportStep >= 2 ? '100%' : '0%';
        if (prog2) prog2.style.width = reportStep === 3 ? '100%' : '0%';

        const prevBtn = document.getElementById('r-btn-prev');
        const nextBtn = document.getElementById('r-btn-next');
        const actions = document.getElementById('r-btn-actions');
        prevBtn?.classList.toggle('hidden', reportStep === 1);
        nextBtn?.classList.toggle('hidden', reportStep === 3);
        actions?.classList.toggle('hidden', reportStep !== 3);
        if (reportStep === 3) {
            renderReportRecap();
        }
    };
    const showReportArchive = (id) => {
        const report = reportSections && reportSections.length ? { sections: reportSections } : null;
        const modal = document.getElementById('report-conv-modal');
        if (!modal) return;
        document.getElementById('report-conv-title').innerText = report ? 'Rapport archivé' : 'Rapport';
        document.getElementById('report-conv-sub').innerText = 'Dossier archivé';
        const list = document.getElementById('report-conv-list');
        if (list) {
            list.innerHTML = report?.sections?.length
                ? report.sections.map((s, idx) => `
                    <div class="relative pl-6">
                        <span class="absolute -left-3 top-2 w-7 h-7 rounded-full flex items-center justify-center bg-sidebar-bg text-sidebar-dark shadow-sm font-bold text-xs">${idx+1}</span>
                        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <p class="text-sm font-semibold text-sidebar-dark">${s.title || 'Section'}</p>
                            <p class="text-xs text-gray-500 mb-2">${s.action || ''}</p>
                            <p class="text-sm text-gray-600 leading-relaxed">${s.desc || ''}</p>
                        </div>
                    </div>
                `).join('') : '<p class="text-sm text-gray-400">Aucun détail archivé.</p>';
        }
        openModal('report-conv-modal');
    };

    const nextReportStep = () => {
        if (reportStep === 1) {
            const contractVal = document.getElementById('report-contract-select')?.value;
            if (!contractVal) { showToast('Choisissez un site / contrat'); return; }
        }
        if (reportStep < 3) {
            reportStep += 1;
            updateReportStepView();
        }
    };

    const prevReportStep = () => {
        if (reportStep > 1) {
            reportStep -= 1;
            updateReportStepView();
        }
    };

    const resetReportModalState = () => {
        reportStep = 1;
        reportAttendees = [];
        reportSections = [];
        document.getElementById('r-step-content-1')?.classList.remove('hidden');
        document.getElementById('r-step-content-2')?.classList.add('hidden');
        document.getElementById('r-step-content-3')?.classList.add('hidden');
        const dot1 = document.getElementById('r-step-dot-1');
        const dot2 = document.getElementById('r-step-dot-2');
        const dot3 = document.getElementById('r-step-dot-3');
        if (dot1) { dot1.className = 'w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-sm md:text-base text-white bg-sidebar-accent transition-colors duration-300'; }
        if (dot2) { dot2.className = 'w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-sm md:text-base text-gray-400 bg-gray-200 transition-colors duration-300'; }
        if (dot3) { dot3.className = 'w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-sm md:text-base text-gray-400 bg-gray-200 transition-colors duration-300'; }
        const p1 = document.getElementById('r-progress-1');
        const p2 = document.getElementById('r-progress-2');
        if (p1) p1.style.width = '0%';
        if (p2) p2.style.width = '0%';
        renderReportAttendees();
        const contractSelect = document.getElementById('report-contract-select');
        if (contractSelect) {
            contractSelect.innerHTML = '<option value=\"\">Choisir un site...</option>' + Object.values(contractsData).map(c => `<option value=\"${c.id}\">${c.siteName || c.name || 'Site'}</option>`).join('');
            contractSelect.value = '';
        }
        const attendeeSelect = document.getElementById('report-attendee-select');
        if (attendeeSelect) {
            attendeeSelect.innerHTML = '<option value=\"\">Choisir une personne...</option>' + employees.map(e => `<option value=\"${e.id}\">${e.name} - ${e.role}</option>`).join('');
            attendeeSelect.value = '';
        }
        const manualName = document.getElementById('report-attendee-name');
        const manualRole = document.getElementById('report-attendee-role');
        if (manualName) manualName.value = '';
        if (manualRole) manualRole.value = '';
        const sectionTitle = document.getElementById('section-title');
        const sectionAction = document.getElementById('section-action');
        const sectionDesc = document.getElementById('section-desc');
        const sectionPhotos = document.getElementById('section-photos-input');
        const sectionPreview = document.getElementById('section-photos-preview');
        if (sectionTitle) sectionTitle.value = '';
        if (sectionAction) sectionAction.value = '';
        if (sectionDesc) sectionDesc.value = '';
        if (sectionPhotos) sectionPhotos.value = '';
        if (sectionPreview) sectionPreview.innerHTML = '';
        renderReportSections();
        const dateInput = document.getElementById('report-date');
        if (dateInput) {
            const now = new Date();
            dateInput.valueAsDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        const timeInput = document.getElementById('report-start-time');
        if (timeInput) {
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            timeInput.value = `${hh}:${mm}`;
        }
        updateReportStepView();
    };

    const openReportModal = () => {
        const modal = document.getElementById('create-report-modal');
        if (!modal) return;
        resetReportModalState();
        modal.classList.remove('hidden');
        setTimeout(() => {
            document.getElementById('report-modal-backdrop')?.classList.remove('opacity-0');
            document.getElementById('report-modal-panel')?.classList.remove('translate-x-full');
        }, 10);
    };

    const closeReportModal = () => {
        const modal = document.getElementById('create-report-modal');
        if (!modal) return;
        document.getElementById('report-modal-backdrop')?.classList.add('opacity-0');
        document.getElementById('report-modal-panel')?.classList.add('translate-x-full');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };

    // --- SOCIETE MODAL ---
    const generateSocieteRef = () => {
        const now = Date.now().toString();
        return `SCT-${now.slice(-6)}`;
    };
    const resetSocieteModal = () => {
        societeRef = generateSocieteRef();
        const setVal = (id, val = "") => { const el = document.getElementById(id); if (el) el.value = val; };
        setVal('societe-ref', societeRef);
        const label = document.getElementById('societe-ref-label');
        if (label) label.innerText = `Ref: ${societeRef}`;
        ['societe-nom','societe-siret','societe-adresse','societe-email','societe-tel','contact-statut','contact-prenom','contact-nom','contact-email','contact-tel','societe-type','remise-pct','remise-mois'].forEach(id => setVal(id, ""));
        const chk = document.getElementById('essaie-30');
        if (chk) chk.checked = false;
        const logoInput = document.getElementById('societe-logo-file');
        if (logoInput) logoInput.value = '';
        const logoPreview = document.getElementById('societe-logo-preview');
        if (logoPreview) {
            logoPreview.style.backgroundImage = '';
            logoPreview.textContent = 'Logo';
        }
    };
    const openSocieteModal = () => {
        resetSocieteModal();
        openModal('create-societe-modal');
    };
    const closeSocieteModal = () => closeModal('create-societe-modal');

    // --- EMPLOYEE MODAL ---
    const generateEmployeeCode = () => {
        const now = Date.now().toString();
        return `EMP-${now.slice(-6)}`;
    };

    const resetEmployeeModal = () => {
        const codeField = document.getElementById('employee-code');
        if (codeField) codeField.value = generateEmployeeCode();
        ['employee-firstname','employee-lastname','employee-email','employee-phone','employee-role','employee-site','employee-address'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    };

    const openEmployeeModal = () => {
        resetEmployeeModal();
        const modal = document.getElementById('create-employee-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.querySelector('.absolute.inset-0')?.classList.remove('opacity-0');
            modal.querySelector('.pointer-events-auto')?.classList.remove('translate-x-full');
        }, 10);
    };

    const closeEmployeeModal = () => {
        const modal = document.getElementById('create-employee-modal');
        if (!modal) return;
        modal.querySelector('.absolute.inset-0')?.classList.add('opacity-0');
        modal.querySelector('.pointer-events-auto')?.classList.add('translate-x-full');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };

    // --- EMPLOYEE DETAIL ---
    const setEmployeeStatusBadge = (status) => {
        const badge = document.getElementById('employee-detail-status');
        if (!badge) return;
        const map = {
            "Actif": "bg-green-100 text-green-700",
            "Demission": "bg-yellow-100 text-yellow-700",
            "Licencie": "bg-red-100 text-red-600",
            "Autre": "bg-gray-100 text-gray-600"
        };
        badge.className = `text-xs font-bold px-2.5 py-1 rounded-full ${map[status] || 'bg-gray-100 text-gray-600'}`;
        badge.innerText = status || 'Statut';
    };

    const populateEmployeeDetail = (id) => {
        const data = employeesData[id] || { id, firstName: '', lastName: '', email: '', phone: '', address: '', site: '', code: generateEmployeeCode(), role: '', status: 'Actif', salary: '', contract: '', note: '' };
        document.getElementById('employee-detail-name').innerText = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Employe';
        document.getElementById('employee-detail-role').innerText = data.role || '-';
        document.getElementById('employee-detail-email').innerText = data.email || '-';
        document.getElementById('employee-detail-phone').innerText = data.phone || '-';
        document.getElementById('employee-detail-address').innerText = data.address || '-';
        document.getElementById('employee-detail-site').innerText = data.site || '-';
        document.getElementById('employee-detail-code').innerText = data.code || '-';
        document.getElementById('employee-detail-salary').value = data.salary || '';
        document.getElementById('employee-detail-contract').value = data.contract || '';
        document.getElementById('employee-detail-note').value = data.note || '';
        document.getElementById('employee-detail-modal').dataset.empId = id;
        setEmployeeStatusBadge(data.status || 'Actif');
        document.querySelectorAll('[data-employee-status-btn]')?.forEach(btn => {
            btn.classList.toggle('bg-sidebar-dark text-white', btn.dataset.status === (data.status || 'Actif'));
            btn.classList.toggle('bg-gray-100 text-gray-700', btn.dataset.status !== (data.status || 'Actif'));
        });
        openModal('employee-detail-modal');
    };

    // --- CLIENT MODAL ---
    const setRecapText = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.innerText = value || "-";
    };

    const resetClientModalFields = () => {
        clientType = null;
        clientStep = 1;
        const modal = document.getElementById('create-client-modal');
        if (!modal) return;
        modal.querySelectorAll('input').forEach(input => {
            if (input.type === 'file' || input.type === 'text' || input.type === 'email' || input.type === 'tel') {
                input.value = "";
            }
        });
        modal.querySelectorAll('textarea').forEach(textarea => textarea.value = "");
        document.querySelectorAll('.address-suggestions').forEach(el => {
            el.innerHTML = "";
            el.classList.add('hidden');
        });
        ['recap-direct-name', 'recap-direct-address', 'recap-direct-email', 'recap-direct-phone', 'recap-mand-company', 'recap-mand-address', 'recap-mand-email', 'recap-mand-phone', 'recap-mand-contact-name', 'recap-mand-contact-email', 'recap-mand-contact-phone'].forEach(id => setRecapText(id, "-"));
    };

    const fillClientRecap = () => {
        if (clientType === 'direct') {
            const first = document.getElementById('client-direct-firstname')?.value.trim() || "";
            const last = document.getElementById('client-direct-lastname')?.value.trim() || "";
            const address = document.getElementById('client-direct-address')?.value.trim() || "";
            const email = document.getElementById('client-direct-email')?.value.trim() || "";
            const phone = document.getElementById('client-direct-phone')?.value.trim() || "";
            setRecapText('recap-direct-name', [first, last].filter(Boolean).join(' ') || "-");
            setRecapText('recap-direct-address', address);
            setRecapText('recap-direct-email', email);
            setRecapText('recap-direct-phone', phone);
        } else if (clientType === 'mandataire') {
            const company = document.getElementById('client-mand-company')?.value.trim() || "";
            const address = document.getElementById('client-mand-address')?.value.trim() || "";
            const email = document.getElementById('client-mand-email')?.value.trim() || "";
            const phone = document.getElementById('client-mand-phone')?.value.trim() || "";
            const contactFirst = document.getElementById('client-mand-contact-firstname')?.value.trim() || "";
            const contactLast = document.getElementById('client-mand-contact-lastname')?.value.trim() || "";
            const contactEmail = document.getElementById('client-mand-contact-email')?.value.trim() || "";
            const contactPhone = document.getElementById('client-mand-contact-phone')?.value.trim() || "";
            setRecapText('recap-mand-company', company);
            setRecapText('recap-mand-address', address);
            setRecapText('recap-mand-email', email);
            setRecapText('recap-mand-phone', phone);
            setRecapText('recap-mand-contact-name', [contactFirst, contactLast].filter(Boolean).join(' ') || "-");
            setRecapText('recap-mand-contact-email', contactEmail);
            setRecapText('recap-mand-contact-phone', contactPhone);
        }
    };

    const showClientDetails = (clientId) => {
        const data = clientsData[clientId];
        if (!data) {
            showToast("Client introuvable");
            return;
        }
        document.getElementById('detail-client-name').innerText = data.name;
        document.getElementById('detail-client-ref').innerText = data.ref || "-";
        document.getElementById('detail-client-type').innerText = data.typeLabel || data.type || "-";
        document.getElementById('detail-client-address').innerText = data.address || "-";
        document.getElementById('detail-client-email').innerText = data.email || "-";
        document.getElementById('detail-client-phone').innerText = data.phone || "-";
        document.getElementById('detail-client-notes').innerText = data.notes || "-";
        const logo = document.getElementById('detail-client-logo');
        if (logo) {
            logo.src = data.logo || "https://placehold.co/64x64/2a9d8f/ffffff?text=C";
        }
        const managerBlock = document.getElementById('detail-manager-block');
        if (data.manager && Object.keys(data.manager).length) {
            managerBlock?.classList.remove('hidden');
            document.getElementById('detail-manager-name').innerText = data.manager.name || "-";
            document.getElementById('detail-manager-email').innerText = data.manager.email || "-";
            document.getElementById('detail-manager-phone').innerText = data.manager.phone || "-";
        } else {
            managerBlock?.classList.add('hidden');
        }
        openModal('client-detail-modal');
    };

    const renderReportConversation = (reportId) => {
        const report = reportsData[reportId];
        if (!report) { showToast('Signalement introuvable'); return; }
        document.getElementById('report-conv-title').innerText = report.title || 'Signalement';
        document.getElementById('report-conv-sub').innerText = `${report.time || '-'} • ${report.site || '-'}`;
        const list = document.getElementById('report-conv-list');
        if (!list) return;
        const typeStyles = {
            creation: { bg: 'bg-blue-100', text: 'text-blue-600', icon: 'fa-qrcode' },
            status: { bg: 'bg-green-100', text: 'text-green-600', icon: 'fa-check' },
            note: { bg: 'bg-purple-100', text: 'text-purple-600', icon: 'fa-message' },
            default: { bg: 'bg-gray-100', text: 'text-gray-500', icon: 'fa-clock' }
        };
        const items = (report.timeline || []).map((step, idx) => {
            const style = typeStyles[step.type] || typeStyles.default;
            const isLast = idx === (report.timeline.length - 1);
            return `
                <div class="relative pl-6">
                    <span class="absolute -left-3 top-2 w-7 h-7 rounded-full flex items-center justify-center ${style.bg} ${style.text} shadow-sm">
                        <i class="fa-solid ${style.icon} text-sm"></i>
                    </span>
                    ${!isLast ? '<span class="absolute -left-px top-8 h-full border-l border-gray-100"></span>' : ''}
                    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <p class="text-sm font-semibold text-sidebar-dark">${step.title || ''}</p>
                        <p class="text-xs text-gray-500 mb-2">${step.time || ''}</p>
                        <p class="text-sm text-gray-600 leading-relaxed">${step.desc || ''}</p>
                    </div>
                </div>
            `;
        }).join('');
        list.innerHTML = items || '<p class="text-sm text-gray-400">Aucun historique.</p>';
        openModal('report-conv-modal');
    };

    const setReportSelectionStyles = (id) => {
        document.querySelectorAll('.report-item').forEach(item => {
            item.classList.toggle('border-gray-200', false);
            item.classList.toggle('border-transparent', true);
            item.classList.remove('bg-white');
        });
        const active = document.querySelector(`[data-id="${id}"].report-item`);
        if (active) {
            active.classList.remove('border-transparent');
            active.classList.add('border-sidebar-border', 'bg-white');
        }
    };

    const showReportDetail = (reportId) => {
        const data = reportsData[reportId];
        if (!data) { showToast('Signalement introuvable'); return; }
        currentReportId = reportId;
        setReportSelectionStyles(reportId);

        const titleEl = document.getElementById('r-detail-title');
        const badgeEl = document.getElementById('r-detail-badge');
        const metaEl = document.getElementById('r-detail-meta');
        const descEl = document.getElementById('r-description');
        const photosEl = document.getElementById('r-photos-container');
        const contentEl = document.getElementById('r-detail-content');
        const detailPanel = document.getElementById('signalements-detail-panel');

        if (titleEl) titleEl.innerText = data.title || 'Signalement';
        if (badgeEl) {
            badgeEl.className = `text-xs font-bold px-2 py-1 rounded-full ${data.statusClass || 'bg-gray-100 text-gray-600'}`;
            badgeEl.innerText = data.status || '-';
            badgeEl.classList.remove('hidden');
        }
        if (metaEl) metaEl.innerText = `${data.time || '-'} • ${data.site || '-'}`;
        if (descEl) descEl.innerText = data.desc || '';
        if (photosEl) {
            photosEl.innerHTML = (data.photos || []).map(src => `<img src="${src}" class="w-24 h-16 object-cover rounded-lg border border-gray-100">`).join('');
        }
        if (contentEl) contentEl.classList.remove('hidden');
        if (detailPanel) detailPanel.classList.remove('translate-x-full');

        const reporterName = document.getElementById('r-reporter-name');
        const reporterPhone = document.getElementById('r-reporter-phone');
        if (reporterName) reporterName.innerText = data.reporter?.name || '-';
        if (reporterPhone) reporterPhone.innerText = data.reporter?.phone || '-';

        const timeline = document.getElementById('timeline-container');
        if (timeline) {
            const steps = (data.timeline || []).map((step, idx) => {
                const colors = {
                    creation: 'bg-blue-100 text-blue-600',
                    status: 'bg-green-100 text-green-600',
                    note: 'bg-purple-100 text-purple-600'
                }[step.type] || 'bg-gray-100 text-gray-500';
                const isLast = idx === (data.timeline.length - 1);
                return `
                    <div class="relative pl-8 pb-8">
                        <span class="absolute -left-1 top-1 w-6 h-6 rounded-full flex items-center justify-center ${colors}">
                            <i class="fa-solid ${step.icon || 'fa-circle-info'} text-xs"></i>
                        </span>
                        ${!isLast ? '<span class="absolute left-1.5 top-6 bottom-0 w-px bg-gray-100"></span>' : ''}
                        <p class="text-sm font-semibold text-sidebar-dark">${step.title || ''}</p>
                        <p class="text-xs text-gray-400 mb-1">${step.time || ''}</p>
                        <p class="text-sm text-gray-600 leading-relaxed">${step.desc || ''}</p>
                    </div>
                `;
            }).join('');
            timeline.innerHTML = steps || '<p class="text-sm text-gray-400 pl-2">Aucun suivi pour ce signalement.</p>';
        }
    };

    const closeReportDetailPanel = () => {
        document.getElementById('signalements-detail-panel')?.classList.add('translate-x-full');
        setReportSelectionStyles(null);
    };

    const toggleEditManagerFields = (type) => {
        const block = document.getElementById('edit-manager-block');
        if (type === 'mandataire') {
            block?.classList.remove('hidden');
        } else {
            block?.classList.add('hidden');
        }
    };

    const populateEditClientModal = (clientId) => {
        const data = clientsData[clientId];
        if (!data) {
            showToast("Client introuvable");
            return;
        }
        editingClientId = clientId;
        document.getElementById('edit-client-title').innerText = data.name || "-";
        document.getElementById('edit-client-ref-label').innerText = data.ref || "-";
        document.getElementById('edit-client-name').value = data.name || "";
        document.getElementById('edit-client-ref').value = data.ref || "";
        document.getElementById('edit-client-type').value = data.type || "direct";
        document.getElementById('edit-client-address').value = data.address || "";
        document.getElementById('edit-client-email').value = data.email || "";
        document.getElementById('edit-client-phone').value = data.phone || "";
        document.getElementById('edit-manager-name').value = data.manager?.name || "";
        document.getElementById('edit-manager-email').value = data.manager?.email || "";
        document.getElementById('edit-manager-phone').value = data.manager?.phone || "";
        toggleEditManagerFields(data.type);
        openModal('edit-client-modal');
    };

    const refreshClientCard = (clientData) => {
        const card = document.querySelector(`[data-client-id="${clientData.id}"]`);
        if (!card) return;
        const nameEl = card.querySelector('[data-client-name]');
        const emailEl = card.querySelector('[data-client-email]');
        const badgeEl = card.querySelector('[data-client-badge]');
        if (nameEl) nameEl.innerText = clientData.name || "-";
        if (emailEl) emailEl.innerText = clientData.email || "-";
        if (badgeEl) {
            if (clientData.type === 'mandataire') {
                badgeEl.className = 'bg-purple-100 text-badge-mandataire px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border border-purple-200';
                badgeEl.innerText = 'Mandataire';
            } else {
                badgeEl.className = 'bg-blue-100 text-badge-direct px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border border-blue-200';
                badgeEl.innerText = 'Client Direct';
            }
        }
    };

    const updateClientStepView = () => {
        for (let i = 1; i <= 3; i++) {
            document.getElementById(`step-content-${i}`)?.classList.toggle('hidden', i !== clientStep);
            const dot = document.getElementById(`step-dot-${i}`);
            if (!dot) continue;
            const isActive = i <= clientStep;
            dot.classList.toggle('step-dot-active', isActive);
            dot.classList.toggle('text-white', isActive);
            dot.classList.toggle('text-gray-500', !isActive);
            const labelGroup = dot.nextElementSibling;
            labelGroup?.querySelectorAll('.step-label')?.forEach(label => label.classList.toggle('step-label-muted', !isActive));
        }
        const progressFill = document.getElementById('step-progress-fill');
        if (progressFill) {
            progressFill.style.width = `${(clientStep / 3) * 100}%`;
        }
        document.getElementById('btn-prev')?.classList.toggle('hidden', clientStep === 1);
        document.getElementById('btn-next')?.classList.toggle('hidden', clientStep !== 2);
        document.getElementById('btn-finish')?.classList.toggle('hidden', clientStep !== 3);
        document.getElementById('form-direct')?.classList.toggle('hidden', clientType !== 'direct');
        document.getElementById('form-mandataire')?.classList.toggle('hidden', clientType !== 'mandataire');
        document.getElementById('client-direct-panel')?.classList.toggle('hidden', clientType !== 'direct');
        document.getElementById('client-mandataire-panel')?.classList.toggle('hidden', clientType !== 'mandataire');
        document.getElementById('recap-direct')?.classList.toggle('hidden', !(clientType === 'direct' && clientStep === 3));
        document.getElementById('recap-mandataire')?.classList.toggle('hidden', !(clientType === 'mandataire' && clientStep === 3));
        document.querySelectorAll('[data-client-card]').forEach(card => {
            const type = card.dataset.clientCard;
            const isSelected = clientType === type;
            card.classList.toggle('border-sidebar-accent/70', isSelected);
            card.classList.toggle('shadow-lg', isSelected);
        });
    };

    const nextClientStep = () => {
        if (clientStep === 1 && !clientType) return;
        if (clientStep === 2) {
            fillClientRecap();
        }
        if (clientStep < 3) {
            clientStep++;
            updateClientStepView();
        }
    };

    const setupAddressAutocomplete = () => {
        if (!window.fetch) return;
        const inputs = document.querySelectorAll('[data-address-input]');
        if (!inputs.length) return;
        const states = new Map();

        const fetchSuggestions = async (query, input, fetchId) => {
            try {
                const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`, { mode: 'cors' });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const data = await response.json();
                const entry = states.get(input);
                if (!entry || entry.fetchId !== fetchId) return;
                const features = data.features || [];
                if (!features.length) {
                    entry.container.innerHTML = '<p class="px-4 py-2 text-xs text-gray-500">Aucun resultat trouve.</p>';
                    entry.container.classList.remove('hidden');
                    return;
                }
                const rows = features.map(feature => {
                    const label = (feature.properties?.label || "").replace(/"/g, '&quot;');
                    return `<button type="button" data-address-value="${label}" class="w-full text-left px-4 py-2 text-xs text-sidebar-dark hover:bg-sidebar-accent/10">${label}</button>`;
                }).join('');
                entry.container.innerHTML = rows;
                entry.container.classList.remove('hidden');
            } catch (error) {
                const entry = states.get(input);
                if (!entry) return;
                entry.container.innerHTML = '<p class="px-4 py-2 text-xs text-red-500">API adresse indisponible.</p>';
                entry.container.classList.remove('hidden');
                console.warn('Adresse API indisponible', error);
            }
        };

        inputs.forEach(input => {
            input.setAttribute('autocomplete', 'off');
            const container = document.createElement('div');
            container.className = 'address-suggestions mt-2 max-h-44 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg text-xs text-sidebar-dark hidden';
            input.after(container);
            states.set(input, { fetchId: 0, container });
            let timer;
            const hideContainer = () => container.classList.add('hidden');
            input.addEventListener('input', () => {
                clearTimeout(timer);
                const search = input.value.trim();
                container.classList.add('hidden');
                container.innerHTML = '';
                if (search.length < 3) return;
                timer = setTimeout(() => {
                    const entry = states.get(input);
                    entry.fetchId += 1;
                    fetchSuggestions(search, input, entry.fetchId);
                }, 300);
            });
            input.addEventListener('focus', () => {
                if (container.innerHTML.trim()) {
                    container.classList.remove('hidden');
                }
            });
            input.addEventListener('blur', () => setTimeout(hideContainer, 200));
            container.addEventListener('click', (event) => {
                const option = event.target.closest('[data-address-value]');
                if (!option) return;
                input.value = option.dataset.addressValue;
                hideContainer();
            });
        });
    };

    // --- CONTRACT MODAL ---
    // --- CONTRACT MODAL ---
    const renderContractContacts = () => {
        const container = document.getElementById('contract-contacts-container');
        if (!container) return;
        container.innerHTML = "";
        contractContacts.forEach((contact, idx) => {
            const row = document.createElement('div');
            row.className = 'grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50 border border-gray-100 rounded-2xl p-3';
            row.innerHTML = `
                <select data-contact-index="${idx}" data-contact-field="role" class="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-sidebar-accent focus:border-sidebar-accent">
                    <option value="Superviseur" ${contact.role === 'Superviseur' ? 'selected' : ''}>Superviseur</option>
                    <option value="Gardien" ${contact.role === 'Gardien' ? 'selected' : ''}>Gardien</option>
                    <option value="Membre du conseil syndical" ${contact.role === 'Membre du conseil syndical' ? 'selected' : ''}>Membre du conseil syndical</option>
                </select>
                <input data-contact-index="${idx}" data-contact-field="name" type="text" class="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-sidebar-accent focus:border-sidebar-accent" placeholder="Nom" value="${contact.name || ''}">
                <input data-contact-index="${idx}" data-contact-field="phone" type="tel" class="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-sidebar-accent focus:border-sidebar-accent" placeholder="Telephone" value="${contact.phone || ''}">
                <button data-action="remove-contract-contact" data-index="${idx}" class="text-red-500 text-sm font-semibold hover:text-red-700">Supprimer</button>
            `;
            container.appendChild(row);
        });
    };

    const updateContractRecap = () => {
        const clientId = document.getElementById('contract-client-select')?.value || "";
        const clientName = clientsData[clientId]?.name || "-";
        const siteName = document.getElementById('contract-site-name')?.value || "-";
        const siteAddress = document.getElementById('contract-site-address')?.value || "-";
        const htMonth = parseFloat(document.getElementById('contract-amount-ht')?.value || "0") || 0;
        const vat = parseFloat(document.getElementById('contract-vat')?.value || "20") || 0;
        const htYear = htMonth * 12;
        const ttcYear = htYear * (1 + vat / 100);

        const set = (id, value) => { const el = document.getElementById(id); if (el) el.innerText = value; };
        set('recap-contract-client', clientName);
        set('recap-contract-site', siteName);
        set('recap-contract-address', siteAddress);
        set('recap-ht-month', htMonth ? `${htMonth.toFixed(2)} € HT` : "-");
        set('recap-ht-year', htYear ? `${htYear.toFixed(2)} € HT` : "-");
        set('recap-ttc-year', ttcYear ? `${ttcYear.toFixed(2)} € TTC` : "-");

        const contactsRecap = document.getElementById('recap-contract-contacts');
        if (contactsRecap) {
            contactsRecap.innerHTML = contractContacts.length ? contractContacts.map(c => `<p>${c.role || '-'} - ${c.name || '-'} (${c.phone || '-'})</p>`).join('') : '<p class="text-xs text-gray-400">Aucun contact</p>';
        }
    };

    const updateContractStepView = () => {
        for (let i = 1; i <= 3; i++) {
            document.getElementById(`c-step-content-${i}`)?.classList.toggle('hidden', i !== contractStep);
             const dot = document.getElementById(`c-step-dot-${i}`);
            if(!dot) continue;
            const isActive = i <= contractStep;
            dot.classList.toggle('step-dot-active', isActive);
            dot.classList.toggle('bg-sidebar-accent', isActive);
            dot.classList.toggle('text-white', isActive);
            dot.classList.toggle('bg-gray-200', !isActive);
            dot.classList.toggle('text-gray-400', !isActive);
        }
        const fill = document.getElementById('c-step-progress-fill');
        if (fill) fill.style.width = `${(contractStep/3)*100}%`;
        document.getElementById('c-btn-prev')?.classList.toggle('hidden', contractStep === 1);
        document.getElementById('c-btn-next')?.classList.toggle('hidden', contractStep === 3);
        document.getElementById('c-btn-finish')?.classList.toggle('hidden', contractStep !== 3);
    };
    const nextContractStep = () => {
        if (contractStep === 1) {
            const clientVal = document.getElementById('contract-client-select')?.value;
            if (!clientVal) { showToast('Choisissez un client'); return; }
        }
        if (contractStep === 2) {
            updateContractRecap();
        }
        if (contractStep < 3) {
            contractStep++;
            updateContractStepView();
        }
    };
    const resetContractModalFields = () => {
        contractStep = 1;
        contractContacts = [];
        const siteNameEl = document.getElementById('contract-site-name');
        if (siteNameEl) { siteNameEl.setAttribute('value',''); siteNameEl.value = ''; }
        const siteAddressEl = document.getElementById('contract-site-address');
        if (siteAddressEl) siteAddressEl.value = '';
        const amountEl = document.getElementById('contract-amount-ht');
        if (amountEl) amountEl.value = '';
        const vatEl = document.getElementById('contract-vat');
        if (vatEl) vatEl.value = '20';
        const select = document.getElementById('contract-client-select');
        if (select) {
            select.innerHTML = '<option value=\"\">Choisir un client...</option>' + Object.values(clientsData).map(c => `<option value=\"${c.id}\">${c.name}</option>`).join('');
            select.value = "";
        }
        renderContractContacts();
        updateContractStepView();
    };
    
    // --- MAIN INITIALIZATION & EVENT HANDLING ---
    const init = () => {
        switchView('dashboard');
        setupAddressAutocomplete();
        attachSocieteLogoPreview('societe-logo-file', 'societe-logo-preview');
        
        document.body.addEventListener('click', (e) => {
            const actionTarget = e.target.closest('[data-action]');
            if (!actionTarget) return;

            e.preventDefault();
            const { action, view, type, text, rowId, id, attendeeName, target } = actionTarget.dataset;

            switch (action) {
                // Navigation & Global
                case 'toggle-sidebar': toggleSidebar(); break;
                case 'switch-view': switchView(view, actionTarget); closeSidebarOnMobile(); break;
                case 'copy-text': navigator.clipboard.writeText(text).then(() => showToast('Copié !')); break;

                // Client Modal
                case 'open-create-client':
                    resetClientModalFields();
                    updateClientStepView();
                    openModal('create-client-modal');
                    break;
                case 'close-create-client': closeModal('create-client-modal'); break;
                case 'select-client-type':
                    clientType = actionTarget?.dataset?.clientType || null;
                    updateClientStepView();
                    nextClientStep();
                    break;
                case 'next-step': nextClientStep(); break;
                case 'prev-step': if (clientStep > 1) { clientStep--; updateClientStepView(); } break;
                case 'finish-creation':
                    showToast("Client cree (simulation)");
                    closeModal('create-client-modal');
                    resetClientModalFields();
                    break;
                case 'open-client-detail':
                    showClientDetails(actionTarget?.dataset?.clientId);
                    break;
                case 'close-client-detail':
                    closeModal('client-detail-modal');
                    break;
                case 'edit-client':
                    populateEditClientModal(actionTarget?.closest('[data-client-id]')?.dataset?.clientId);
                    break;
                case 'close-edit-client':
                    closeModal('edit-client-modal');
                    break;
                case 'edit-client-type-change':
                    toggleEditManagerFields(actionTarget.value);
                    break;
                case 'save-client-edit': {
                    if (!editingClientId) { showToast('Aucun client selectionne'); break; }
                    const data = clientsData[editingClientId] || {};
                    const type = document.getElementById('edit-client-type').value || 'direct';
                    data.name = document.getElementById('edit-client-name').value || data.name;
                    data.ref = document.getElementById('edit-client-ref').value || data.ref;
                    data.type = type;
                    data.typeLabel = type === 'mandataire' ? 'Mandataire' : 'Client Direct';
                    data.address = document.getElementById('edit-client-address').value || '';
                    data.email = document.getElementById('edit-client-email').value || '';
                    data.phone = document.getElementById('edit-client-phone').value || '';
                    if (type === 'mandataire') {
                        data.manager = {
                            name: document.getElementById('edit-manager-name').value || '',
                            email: document.getElementById('edit-manager-email').value || '',
                            phone: document.getElementById('edit-manager-phone').value || ''
                        };
                    } else {
                        data.manager = null;
                    }
                    clientsData[editingClientId] = data;
                    refreshClientCard(data);
                    if (!document.getElementById('client-detail-modal').classList.contains('hidden')) {
                        showClientDetails(editingClientId);
                    }
                    showToast('Client mis a jour');
                    closeModal('edit-client-modal');
                    break;
                }

                // Contract Modal
                case 'open-create-contract':
                    resetContractModalFields();
                    updateContractStepView();
                    openModal('create-contract-modal');
                    break;
                case 'close-create-contract': closeModal('create-contract-modal'); break;
                case 'contract-next-step': nextContractStep(); break;
                case 'contract-prev-step': if (contractStep > 1) { contractStep--; updateContractStepView(); } break;
                case 'add-contract-contact':
                    contractContacts.push({ role: 'Superviseur', name: '', phone: '' });
                    renderContractContacts();
                    break;
                case 'remove-contract-contact':
                    contractContacts.splice(parseInt(actionTarget.dataset.index,10),1);
                    renderContractContacts();
                    break;
                case 'finish-contract-creation':
                    updateContractRecap();
                    showToast("Contrat cree (simulation)");
                    closeModal('create-contract-modal');
                    break;
                case 'add-report-attendee': {
                    const select = document.getElementById('report-attendee-select');
                    const val = select?.value;
                    if (!val) { showToast('Selectionnez une personne'); break; }
                    const emp = employees.find(e => String(e.id) === String(val));
                    if (!emp) { showToast('Personne introuvable'); break; }
                    if (reportAttendees.some(a => a.id === emp.id)) { showToast('Deja ajoutee'); break; }
                    reportAttendees.push({ id: emp.id, name: emp.name, role: emp.role });
                    renderReportAttendees();
                    select.value = '';
                    break;
                }
                case 'remove-report-attendee': {
                    const idx = parseInt(actionTarget.dataset.index, 10);
                    if (Number.isInteger(idx)) {
                        reportAttendees.splice(idx, 1);
                        renderReportAttendees();
                    }
                    break;
                }
                case 'add-report-attendee-manual': {
                    const nameInput = document.getElementById('report-attendee-name');
                    const roleInput = document.getElementById('report-attendee-role');
                    const nameVal = nameInput?.value.trim();
                    if (!nameVal) { showToast('Saisissez un nom'); break; }
                    reportAttendees.push({ id: `custom-${Date.now()}`, name: nameVal, role: roleInput?.value.trim() || 'Invite' });
                    renderReportAttendees();
                    if (nameInput) nameInput.value = '';
                    if (roleInput) roleInput.value = '';
                    break;
                }
                case 'trigger-section-photo-picker':
                    document.getElementById('section-photos-input')?.click();
                    break;
                case 'add-report-section': {
                    const title = document.getElementById('section-title')?.value.trim();
                    const actionTxt = document.getElementById('section-action')?.value.trim();
                    const desc = document.getElementById('section-desc')?.value.trim();
                    if (!title && !desc) { showToast('Ajoutez un titre ou une description'); break; }
                    const files = Array.from(document.getElementById('section-photos-input')?.files || []).slice(0, 5).map(f => f.name);
                    reportSections.push({ title, action: actionTxt, desc, photos: files });
                    renderReportSections();
                    if (document.getElementById('section-title')) document.getElementById('section-title').value = '';
                    if (document.getElementById('section-action')) document.getElementById('section-action').value = '';
                    if (document.getElementById('section-desc')) document.getElementById('section-desc').value = '';
                    const preview = document.getElementById('section-photos-preview');
                    if (preview) preview.innerHTML = '';
                    const input = document.getElementById('section-photos-input');
                    if (input) input.value = '';
                    showToast('Section ajoutée');
                    break;
                }
                case 'remove-report-section': {
                    const idx = parseInt(actionTarget.dataset.index, 10);
                    if (Number.isInteger(idx)) {
                        reportSections.splice(idx, 1);
                        renderReportSections();
                    }
                    break;
                }
                case 'report-next-step':
                    nextReportStep();
                    break;
                case 'report-prev-step':
                    prevReportStep();
                    break;
                case 'finish-report':
                    renderReportRecap();
                    showToast('Rapport finalisé (simulation)');
                    closeReportModal();
                    break;
                case 'open-create-report':
                    openReportModal();
                    break;
                case 'close-create-report':
                    closeReportModal();
                    break;
                case 'open-report':
                    showReportDetail(actionTarget?.dataset?.id);
                    break;
                case 'open-report-archive':
                    showReportArchive(actionTarget?.dataset?.reportId || actionTarget?.dataset?.id);
                    break;
                case 'close-report-details':
                    closeReportDetailPanel();
                    break;
                case 'close-report-conv':
                    closeModal('report-conv-modal');
                    break;
                case 'open-create-employee':
                    openEmployeeModal();
                    break;
                case 'close-create-employee':
                    closeEmployeeModal();
                    break;
                case 'save-employee':
                    showToast('Employe cree (simulation)');
                    closeEmployeeModal();
                    break;
                case 'open-create-societe':
                    openSocieteModal();
                    break;
                case 'close-create-societe':
                    closeSocieteModal();
                    break;
                case 'save-societe':
                    handleSocieteSave();
                    break;
                case 'close-employee-detail':
                    closeModal('employee-detail-modal');
                    break;
                case 'open-employee-detail':
                    populateEmployeeDetail(actionTarget?.dataset?.employeeId);
                    break;
                case 'set-employee-status': {
                    const status = actionTarget.dataset.status;
                    const empId = document.getElementById('employee-detail-modal')?.dataset?.empId;
                    if (empId && employeesData[empId]) {
                        employeesData[empId].status = status;
                        setEmployeeStatusBadge(status);
                        document.querySelectorAll('[data-employee-status-btn]')?.forEach(btn => {
                            btn.classList.toggle('bg-sidebar-dark text-white', btn.dataset.status === status);
                            btn.classList.toggle('bg-gray-100 text-gray-700', btn.dataset.status !== status);
                        });
                        showToast(`Statut mis a jour: ${status}`);
                    }
                    break;
                }
                case 'save-employee-detail': {
                    const empId = document.getElementById('employee-detail-modal')?.dataset?.empId;
                    if (empId && employeesData[empId]) {
                        employeesData[empId].salary = document.getElementById('employee-detail-salary')?.value || '';
                        employeesData[empId].contract = document.getElementById('employee-detail-contract')?.value || '';
                        employeesData[empId].note = document.getElementById('employee-detail-note')?.value || '';
                        showToast('Employe mis a jour (simulation)');
                        closeModal('employee-detail-modal');
                    }
                    break;
                }
                case 'delete-employee': {
                    const empId = document.getElementById('employee-detail-modal')?.dataset?.empId;
                    if (empId && confirm('Supprimer cet employe ?')) {
                        showToast('Employe supprime (simulation)');
                        closeModal('employee-detail-modal');
                    }
                    break;
                }
                
                // CRUD Placeholders
                case 'edit-client': showToast(`Modifier client ${id} (TODO)`); break;
                case 'delete-client': if (confirm('Supprimer ce client ?')) showToast('Client supprimé (simulation)'); break;
                case 'edit-contract': showToast(`Modifier contrat ${id} (TODO)`); break;
                case 'delete-contract': if (confirm('Supprimer ce contrat ?')) showToast('Contrat supprimé (simulation)'); break;
                
                default: console.warn('Unhandled action:', action);
            }
        });

        document.body.addEventListener('input', (e) => {
            const target = e.target;
            if (target.dataset.contactField !== undefined) {
                const idx = parseInt(target.dataset.contactIndex, 10);
                if (Number.isInteger(idx) && contractContacts[idx]) {
                    contractContacts[idx][target.dataset.contactField] = target.value;
                }
            }
            if (target.id === 'section-photos-input') {
                const preview = document.getElementById('section-photos-preview');
                if (!preview) return;
                const files = Array.from(target.files || []).slice(0, 5);
                preview.innerHTML = files.length
                    ? files.map(f => `<span class="text-[10px] bg-gray-100 px-2 py-1 rounded">${f.name}</span>`).join(' ')
                    : '';
            }
        });
    };

    init();
});
























        // Card listeners (explicit to avoid delegated conflicts)
        document.querySelectorAll('[data-employee-id]').forEach(card => {
            card.addEventListener('click', (evt) => {
                if (evt.target.closest('button')) return;
                evt.preventDefault();
                populateEmployeeDetail(card.dataset.employeeId);
            });
        });
        document.querySelectorAll('[data-contract-id]').forEach(card => {
            card.addEventListener('click', (evt) => {
                if (evt.target.closest('button')) return;
                evt.preventDefault();
                populateEmployeeDetail(card.dataset.contractId); // TODO: replace with contract detail when ready
            });
        });

