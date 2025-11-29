document.addEventListener('DOMContentLoaded', () => {
    // --- DATA (Simulated Database) ---
    const contractsData = {
        1: { id: 1, name: "Maintenance Mensuelle", ref: "CTR-2023-452", clientId: "2", siteName: "Site Alpha - Maintenance Mensuelle", siteAddress: "45 Rue du Port, 75002 Paris", startDate: "2023-01-01", endDate: "2025-12-31", alertDays: "60", amountHT: "12000", vatRate: "20", contacts: [{ role: "Gardien", name: "Jean Dupont", phone: "06 11 22 33 44" }], reports: [] },
        2: { id: 2, name: "Audit Sécurité", ref: "CTR-2023-480", clientId: "1", siteName: "Résidence Lilas - Audit Sécurité", siteAddress: "18 Avenue des Lilas, 75020 Paris", startDate: "2023-03-15", endDate: "2025-03-14", alertDays: "45", amountHT: "8500", vatRate: "20", contacts: [{ role: "Technique", name: "Sophie Leroy", phone: "06 55 44 33 22" }], reports: [] }
    };
    const clientsData = {
        1: {id: 1, name: "M. Jean Dupont", ref: "CLI-2023-089", type: "direct"},
        2: {id: 2, name: "Agence Immo 2000", ref: "CLI-2023-090", type: "mandataire"}
    };
    const reportsData = {
        1: { id: 1, contractId: 1, title: "Fuite d'eau - Local Technique", desc: "J'ai remarqué une flaque d'eau importante près de la chaudière. Ça semble couler du tuyau principal.", status: "Nouveau", statusClass: "bg-red-100 text-red-600", site: "Site Alpha Logistics", time: "29 Nov, 14:30", reporter: { name: "Marc Weber", phone: "06 88 77 66 55" }, photos: ["https://placehold.co/300x200/png?text=Photo+Fuite"], timeline: [{ type: 'creation', title: 'Signalement créé', time: '14:30', desc: "Un utilisateur a scanné le QR Code du Hall d'entrée.", icon: 'fa-qrcode', color: 'red' }] },
        2: { id: 2, contractId: 2, title: "Porte Garage Bloquée", desc: "La porte du garage souterrain ne s'ouvre plus avec le badge. Moteur semble HS.", status: "En cours", statusClass: "bg-orange-100 text-orange-600", site: "Résidence Lilas", time: "Hier, 09:15", reporter: { name: "Sophie Martin", phone: "07 12 34 56 78" }, photos: [], timeline: [{ type: 'creation', title: 'Signalement créé', time: 'Hier, 09:15', desc: "Scan QR Code Garage.", icon: 'fa-qrcode', color: 'orange' }, { type: 'note', title: 'Prise en charge', time: 'Hier, 09:30', desc: "Dossier pris en compte.", icon: 'fa-user-check', color: 'blue' }, { type: 'status', title: 'En cours de résolution', time: 'Hier, 10:00', desc: "Technicien en route.", icon: 'fa-screwdriver-wrench', color: 'orange' }] },
        3: { id: 3, contractId: 1, title: "Lumière Hall HS", desc: "Plus de lumière dans le hall B au rdc.", status: "Résolu", statusClass: "bg-green-100 text-green-600", site: "Site Alpha", time: "24 Oct, 18:00", reporter: { name: "Gardien", phone: "01 22 33 44 55" }, photos: [], isResolved: true, timeline: [{ type: 'creation', title: 'Signalement créé', time: '24 Oct, 18:00', desc: "Ampoule grillée.", icon: 'fa-qrcode', color: 'gray' }, { type: 'note', title: 'Réparation effectuée', time: '25 Oct, 09:00', desc: "Ampoule remplacée.", icon: 'fa-check', color: 'green' }] }
    };
    const employees = [
        { id: 1, name: "Thomas Martin", role: "Agent d'entretien", avatarColor: "bg-blue-100 text-blue-600" },
        { id: 2, name: "Julie Dubois", role: "Superviseur", avatarColor: "bg-purple-100 text-purple-600" },
        { id: 3, name: "Lucas Bernard", role: "Technicien", avatarColor: "bg-orange-100 text-orange-600" }
    ];

    // --- STATE ---
    let currentContractId = null;
    let editingContractId = null;
    let currentReportId = null;
    let currentAssignedEmployeeId = 1;
    let signaturePad;
    let clientStep = 1;
    let contractStep = 1;

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
        ['view-dashboard', 'view-clients', 'view-contrats', 'view-signalements', 'view-rapports'].forEach(id => {
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
        setTimeout(() => toast.classList.add('hidden'), 2000);
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

    // --- CLIENT MODAL ---
    const updateClientStepView = () => {
        for (let i = 1; i <= 3; i++) {
            document.getElementById(`step-content-${i}`)?.classList.toggle('hidden', i !== clientStep);
            const dot = document.getElementById(`step-dot-${i}`);
            if(!dot) continue;
            dot.classList.toggle('bg-sidebar-accent', i <= clientStep);
            dot.classList.toggle('text-white', i <= clientStep);
            dot.classList.toggle('bg-gray-200', i > clientStep);
            dot.classList.toggle('text-gray-400', i > clientStep);
        }
        document.getElementById('btn-prev')?.classList.toggle('hidden', clientStep === 1);
        document.getElementById('btn-next')?.classList.toggle('hidden', clientStep !== 2);
        document.getElementById('btn-finish')?.classList.toggle('hidden', clientStep !== 3);
    };
    const nextClientStep = () => {
        if (clientStep < 3) {
            clientStep++;
            updateClientStepView();
            if (clientStep === 3) {
                document.getElementById('recap-name').innerText = document.getElementById('input-name').value || "-";
                document.getElementById('recap-address').innerText = document.getElementById('input-address').value || "-";
                document.getElementById('recap-email').innerText = document.getElementById('input-email').value || "-";
            }
        }
    };

    // --- CONTRACT MODAL ---
    const updateContractStepView = () => {
        for (let i = 1; i <= 3; i++) {
            document.getElementById(`c-step-content-${i}`)?.classList.toggle('hidden', i !== contractStep);
             const dot = document.getElementById(`c-step-dot-${i}`);
            if(!dot) continue;
            dot.classList.toggle('bg-sidebar-accent', i <= contractStep);
            dot.classList.toggle('text-white', i <= contractStep);
            dot.classList.toggle('bg-gray-200', i > contractStep);
            dot.classList.toggle('text-gray-400', i > contractStep);
        }
        document.getElementById('c-btn-prev')?.classList.toggle('hidden', contractStep === 1);
        document.getElementById('c-btn-next')?.classList.toggle('hidden', contractStep === 3);
        document.getElementById('c-btn-finish')?.classList.toggle('hidden', contractStep !== 3);
    };
    const nextContractStep = () => {
        if (contractStep < 3) {
            contractStep++;
            updateContractStepView();
        }
    };
    
    // --- MAIN INITIALIZATION & EVENT HANDLING ---
    const init = () => {
        switchView('dashboard');
        
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
                case 'open-create-client': clientStep = 1; updateClientStepView(); openModal('create-client-modal'); break;
                case 'close-create-client': closeModal('create-client-modal'); break;
                case 'select-client-type': nextClientStep(); break;
                case 'next-step': nextClientStep(); break;
                case 'prev-step': if (clientStep > 1) { clientStep--; updateClientStepView(); } break;
                case 'finish-creation': showToast("Client créé (simulation)"); closeModal('create-client-modal'); break;

                // Contract Modal
                case 'open-create-contract': contractStep = 1; updateContractStepView(); openModal('create-contract-modal'); break;
                case 'close-create-contract': closeModal('create-contract-modal'); break;
                case 'contract-next-step': nextContractStep(); break;
                case 'contract-prev-step': if (contractStep > 1) { contractStep--; updateContractStepView(); } break;
                case 'finish-contract-creation': showToast("Contrat créé (simulation)"); closeModal('create-contract-modal'); break;
                
                // CRUD Placeholders
                case 'edit-client': showToast(`Modifier client ${id} (TODO)`); break;
                case 'delete-client': if (confirm('Supprimer ce client ?')) showToast('Client supprimé (simulation)'); break;
                case 'edit-contract': showToast(`Modifier contrat ${id} (TODO)`); break;
                case 'delete-contract': if (confirm('Supprimer ce contrat ?')) showToast('Contrat supprimé (simulation)'); break;
                
                default: console.warn('Unhandled action:', action);
            }
        });
    };

    init();
});