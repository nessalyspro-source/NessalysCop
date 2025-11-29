const fs = require('fs');
const path = 'scripts/app.js';
let text = fs.readFileSync(path, 'utf8');
const startMarker = '                function addReportSection()';
const endMarker = '                function finishReport()';
const start = text.indexOf(startMarker);
const end = text.indexOf(endMarker, start);
if (start === -1 || end === -1) {
  throw new Error('Markers not found');
}
const replacement = `
                function addReportSection() {
                    const titleInput = document.getElementById('section-title');
                    const descInput = document.getElementById('section-desc');
                    const actionInput = document.getElementById('section-action');
                    const title = titleInput?.value.trim();
                    const desc = descInput?.value.trim();
                    const action = actionInput?.value.trim() || 'Aucune action planifiée';

                    if (!title || !desc) {
                        showToast("Le titre et la description sont obligatoires pour valider une section.");
                        return;
                    }

                    const sectionsList = document.getElementById('report-sections-list');
                    if (!sectionsList) return;

                    const card = document.createElement('div');
                    card.className = "report-section bg-white rounded-2xl border border-gray-200 shadow-sm p-5 relative";
                    card.innerHTML = `
                        <div class="flex justify-between items-start gap-3 mb-3">
                            <div>
                                <h5 class="text-base font-semibold text-sidebar-dark mb-1">${title}</h5>
                                <p class="text-sm text-gray-500">${desc}</p>
                            </div>
                            <button type="button" onclick="removeReportSection(this)" class="text-gray-400 hover:text-red-500 transition-colors" aria-label="Supprimer la section">
                                <i class="fa-regular fa-trash-can"></i>
                            </button>
                        </div>
                        <span class="text-[11px] font-medium text-gray-400 uppercase tracking-wide">${action}</span>
                    `;

                    sectionsList.appendChild(card);

                    titleInput.value = '';
                    descInput.value = '';
                    actionInput.value = '';

                    showToast('Section ajoutée.');
                }

                function removeReportSection(button) {
                    const section = button.closest('.report-section');
                    if (section) {
                        section.remove();
                        showToast('Section supprimée.');
                    }
                }
`;
text = text.slice(0, start) + replacement + text.slice(end);
fs.writeFileSync(path, text, 'utf8');
