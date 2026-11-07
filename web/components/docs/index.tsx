'use client';
// Area entry (documents): any file type, document viewer, Document Studio and digital signatures.
// Registers renderers, overlays, menu items and cross-area actions in lib/registry. See PORTING.md.
import { messageRenderers, overlays, menuHooks, register } from '@/lib/registry';
import { sendFiles, cloudUpload, cloudChat, DropZone } from './files';
import { openDocViewer, DocBubble } from './viewer';
import { openStudio, closeStudio, Studio } from './studio';
import { signRequestModal, sendSignRequest, openSignFlow, signCertModal, signaturePad, signedDocOf, simulateSigning, SignReqBubble } from './signature';
import { extraMsgItems } from './menu';
import { downloadDoc, printDoc } from './lib';

messageRenderers.doc = DocBubble;
messageRenderers.signreq = SignReqBubble;
overlays.studio = Studio;
overlays.docDrop = DropZone;
menuHooks.message.push(extraMsgItems);

register({
  openDocViewer, openStudio, closeStudio, signRequestModal, sendSignRequest, openSignFlow, sendFiles, cloudUpload, cloudChat,
  signCertModal, signaturePad, signedDocOf, simulateSigning, downloadDoc, printDoc, extraMsgItems,
});
