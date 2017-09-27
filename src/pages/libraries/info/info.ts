import { Component, ViewChild } from "@angular/core";
import { NgForm } from "@angular/forms";
import { Http } from "@angular/http";
import { NavController, NavParams, ViewController, ActionSheetController, AlertController } from "ionic-angular";
import { Keyboard } from "@ionic-native/keyboard";
import { CompleterService, CompleterData, CompleterItem, CompleterCmp } from "ng2-completer";
import { ImageCropperComponent, CropperSettings } from "ng2-img-cropper";
import { List } from "linqts";
import "rxjs/add/operator/map";

import { AppUtility } from "../../../helpers/utility";
import { AppEvents } from "../../../helpers/events";
import { AppAPI } from "../../../helpers/api";
import { AppData } from "../../../models/data";
import { AppModels } from "../../../models/objects";

import { ConfigurationService } from "../../../providers/configuration";
import { AuthenticationService } from "../../../providers/authentication";
import { LibrariesService } from "../../../providers/libraries";

import { AddBookPage } from "../../books/add/add";

@Component({
	selector: "page-library-info",
	templateUrl: "info.html",
})
export class LibraryInfoPage {
	constructor(
		public http: Http,
		public navCtrl: NavController,
		public navParams: NavParams,
		public viewCtrl: ViewController,
		public actionSheetCtrl: ActionSheetController,
		public alertCtrl: AlertController,
		public completerSvc: CompleterService,
		public keyboard: Keyboard,
		public configSvc: ConfigurationService,
		public authSvc: AuthenticationService,
		public librariesSvc: LibrariesService
	){
		this.info.state.mode = this.configSvc.isAuthenticated() && AppUtility.isTrue(this.navParams.get("Register"))
			? "Register"
			: "Info";
		this.initialize();

		// image cropper
		this.cropper.settings.width = 100;
		this.cropper.settings.height = 100;
		this.cropper.settings.croppedWidth = 300;
		this.cropper.settings.croppedHeight = 300;
		this.cropper.settings.canvasWidth = 272;
		this.cropper.settings.canvasHeight = 272;
		this.cropper.settings.noFileInput = true;
	}

	// attributes
	info = {
		title: "Thư viện",
		status: {
			refreshing: false,
		},
		state: {
			mode: "Info",
			processing: true,
			valid: true,
			css: ""
		},
		id: "",
		library: new AppModels.Library(),
		avatar: {
			current: "",
			uploaded: ""
		},
		rating: 0.0,
		address: {
			current: undefined,
			addresses: undefined
		},
		isAppleOS: AppUtility.isAppleOS()
	};
	privileges: { current: AppModels.Privileges, edit: any } = { current: undefined, edit: undefined };
	addressCompleter: CompleterData = undefined;
	accountCompleter: AppAPI.CompleterCustomSearch = undefined;
	cropper = {
		settings: new CropperSettings(),
		data: {
			image: "",
			original: undefined
		}
	};

	// controls
	@ViewChild("title") titleCtrl;
	@ViewChild("alias") aliasCtrl;
	@ViewChild("address") addressCtrl;
	@ViewChild("contactEmail") contactEmailCtrl;
	@ViewChild("contactName") contactNameCtrl;
	@ViewChild("contactPhone") contactPhoneCtrl;
	
	@ViewChild("avatarcropper") cropperCtrl: ImageCropperComponent;

	@ViewChild("addresses") addressesCtrl: CompleterCmp;
	@ViewChild("administrator") administratorCtrl: CompleterCmp;
	@ViewChild("moderator") moderatorCtrl: CompleterCmp;
	
	// page events
	ionViewDidLoad() {
		this.info.state.processing = false;
		this.info.state.css = AppUtility.getInputCss();

		AppEvents.on(
			"LibraryIsUpdated",
			(info: any) => {
				if (this.info.library != undefined && this.info.library.ID == info.args.ID) {
					this.initializeLibrary(info.args.ID);
				}
			},
			"EventHandlerToUpdateLibraryInfoOnPage"
		);
	}

	ionViewDidEnter() {
		if (this.info.state.mode == "Register") {
			this.setBackButton(false);
			AppUtility.focus(this.titleCtrl, this.keyboard, 123);
		}
	}

	ionViewWillUnload() {
		AppEvents.off("LibraryIsUpdated", "EventHandlerToUpdateLibraryInfoOnPage");
	}

	// run initialize
	initialize() {
		// library info
		if (this.info.state.mode == "Register") {
			this.info.title = "Đăng ký thư viện";
		}
		else {
			this.initializeLibrary(this.navParams.get("ID"));
		}

		// search address
		this.info.address = AppUtility.initializeAddress(this.info.library.Contact);
		this.addressCompleter = this.completerSvc.local(this.info.address.addresses, "title,titleANSI", "title");

		// search accounts
		this.accountCompleter = new AppAPI.CompleterCustomSearch(
			(term: string) => {
				return "users/profile/search"
					+ "?x-request=" + AppUtility.getBase64UrlParam(AppData.buildRequest({ Query: term }))
					+ "&related-service=libraries"
					+ "&language=vi-VN";
			},
			(data: any) => {
				if (data.Status == "OK") {
					return new List<any>(data.Data.Objects)
						.Select(a => {
							return {
								title: a.Name,
								description: a.Email,
								image: AppUtility.getAvatarImage(a),
								originalObject: AppModels.Account.deserialize(a)
							} as CompleterItem;
						})
						.ToArray();
				}
				else {
					console.error("Error occurred while searching account", data);
					return new Array<CompleterItem>();
				}
			}
		);
	}

	initializeLibrary(id: string) {
		let library = AppData.Libraries.getValue(id);
		this.privileges.current = library.Privileges;
		this.info.library = AppUtility.clone(library, ["Privileges"]);

		this.info.avatar.current = AppUtility.getAvatarImage(library);
		this.info.title = "Thư viện: " + library.Title;

		var rating = library.RatingPoints != undefined
			? library.RatingPoints.getValue("General")
			: undefined;
		this.info.rating = rating != undefined
			? rating.Average
			: 0;

		if (!library.Books) {
			this.librariesSvc.getBooks(library.ID);
		}
	}

	// event handlers
	showActions() {
		var actionSheet = this.actionSheetCtrl.create({
			enableBackdropDismiss: true,
			buttons: [
				{
					text: "Xử lý yêu cầu mượn/trả",
					icon: this.info.isAppleOS ? undefined : "analytics",
					handler: () => {
						
					}
				}
			]
		});

		if (this.isAdministrator()) {
			actionSheet.addButton({
				text: "Cập nhật",
				icon: this.info.isAppleOS ? undefined : "create",
				handler: () => {
					this.openUpdate();
				}
			});
			actionSheet.addButton({
				text: "Đặt quyền truy cập",
				icon: this.info.isAppleOS ? undefined : "settings",
				handler: () => {
					this.openPrivileges();
				}
			});
		}

		actionSheet.addButton({
			text: "Huỷ bỏ",
			icon: this.info.isAppleOS ? undefined : "close",
			role: "cancel"
		});
		actionSheet.present();
	}

	openUpdate() {
		this.setBackButton(false);
		this.info.state.mode = "Update";
		this.info.title = "Cập nhật thông tin thư viện";
		this.cropper.data.image = this.info.avatar.current;
		AppUtility.focus(this.titleCtrl, this.keyboard, 123);
	}

	selectAddress(address: CompleterItem) {
		if (AppUtility.isObject(address, null) && AppUtility.isObject(address.originalObject, null)) {
			this.info.address.current = address.originalObject;
		}
	}

	openPrivileges() {
		this.setBackButton(false);
		this.info.state.mode = "SetPrivileges";
		this.info.title = "Đặt quyền truy cập";
		this.privileges.edit = {
			Processing: "",
			Owner: undefined,
			Administrators: [],
			Moderators: []
		};

		this.privileges.edit.Owner = AppData.Accounts.getValue(this.info.library.OwnerID);
		if (this.privileges.edit.Owner == undefined) {
			this.authSvc.getProfileAsync(true, this.info.library.OwnerID, () => {
				this.privileges.edit.Owner = AppData.Accounts.getValue(this.info.library.OwnerID);
			});
		}

		new List(this.info.library.Privileges ? this.info.library.Privileges.AdministrativeUsers.toArray() : [])
			.ForEach(id => {
				let account = AppData.Accounts.getValue(id);
				if (account) {
					this.privileges.edit.Administrators.push(account);
				}
				else {
					this.authSvc.getProfileAsync(true, id, () => {
						this.privileges.edit.Administrators.push(AppData.Accounts.getValue(id));
					});
				}
			});
		
		new List(this.info.library.Privileges ? this.info.library.Privileges.ModerateUsers.toArray() : [])
			.ForEach(id => {
				let account = AppData.Accounts.getValue(id);
				if (account != undefined) {
					this.privileges.edit.Moderators.push(account);
				}
				else {
					this.authSvc.getProfileAsync(true, id, () => {
						this.privileges.edit.Moderators.push(AppData.Accounts.getValue(id));
					});
				}
			});
	}

	selectAccount(account: CompleterItem) {
		if (AppUtility.isObject(account, null) && AppUtility.isObject(account.originalObject, null)) {
			if (this.privileges.edit.Processing == "Administrator") {
				this.privileges.edit.Administrators.push(account.originalObject);
			}
			else {
				this.privileges.edit.Moderators.push(account.originalObject);
			}
		}
	}

	addAccount(mode: string) {
		this.privileges.edit.Processing = mode;
		AppUtility.focus(this.privileges.edit.Processing == "Administrator" ? this.administratorCtrl.ctrInput : this.moderatorCtrl.ctrInput, this.keyboard);
	}

	removeAccount(mode: string, id: string) {
		var accounts = this.privileges.edit.Processing == "Administrator"
			? this.privileges.edit.Administrators
			: this.privileges.edit.Moderators;
		var index = AppUtility.find<AppModels.Account>(accounts, a => a.ID == id);
		if (index > -1) {
			accounts.splice(index, 1);
		}
	}

	trackAccount(index: number, account: AppModels.Account) {
		return account.ID;
	}

	// helpers
	setBackButton(state: boolean) {
		this.viewCtrl.showBackButton(state);
	}

	cancel() {
		if (this.info.state.mode == "Register") {
			this.exit();
		}
		else {
			this.cancelUpdate();
		}
	}

	cancelUpdate() {
		this.info.state.processing = false;
		this.setBackButton(true);
		this.info.state.mode = "Info";
		this.info.title = "Thư viện: " + this.info.library.Title;
	}

	exit() {
		this.navCtrl.pop();
	}

	getAliasUri() {
		return AppUtility.getUri() + "#?lib=" + this.info.library.Alias.toLowerCase();
	}

	getIntroHtml() {
		return AppUtility.normalizeHtml(this.info.library.Intro);
	}

	getAvatar(account: AppModels.Account) {
		return AppUtility.getAvatarImage(account);
	}

	isAdministrator() {
		return this.info.library != undefined 
			? this.authSvc.isSystemAdministrator()
				|| this.info.library.OwnerID == AppData.Configuration.session.account.id
				|| this.authSvc.canManage(undefined, undefined, this.privileges.current)
			: false;
	}

	isModerator() {
		return this.info.library != undefined 
			? this.isAdministrator() || this.authSvc.canModerate(undefined, undefined, this.privileges.current)
			: false;
	}

	isNotEmpty(value: string) {
		return AppUtility.isNotEmpty(value);
	}

	isValidEmail(email: string) {
		return AppUtility.isValidEmail(email);
	}

	isValidInfo(form: NgForm) {
		if (!form.valid) {
			if (!form.controls.title.valid) {
				AppUtility.focus(this.titleCtrl, this.keyboard);
			}
			else if (!form.controls.alias.valid) {
				AppUtility.focus(this.aliasCtrl, this.keyboard);
			}
			else if (!form.controls.address.valid) {
				AppUtility.focus(this.addressCtrl, this.keyboard);
			}
			else if (!this.info.address.current) {
				AppUtility.focus(this.addressesCtrl.ctrInput, this.keyboard);
			}
			return false;
		}
		else {
			return form.valid;
		}
	}

	showError(data: any, setFocus?: () => void) {
		this.info.state.processing = false;
		var message = AppUtility.isObject(data.Error) && AppUtility.isNotEmpty(data.Error.Message)
			? data.Error.Message
			: "Đã xảy ra lỗi!"
		this.showAlert("Lỗi!", message);
	}

	showAlert(title: string, message: string, handler?: () => void) {
		this.alertCtrl.create({
			title: title,
			message: message,
			enableBackdropDismiss: false,
			buttons: [{
				text: "Đóng",
				handler: handler
			}]
		}).present();
	}

	// register
	doRegister(form: NgForm) {
		this.info.state.valid = this.isValidInfo(form);
		if (this.info.state.valid) {
			this.info.state.processing = true;
			this.info.library.Contact.County = this.info.address.current.county;
			this.info.library.Contact.Province = this.info.address.current.province;
			this.info.library.Contact.Country = this.info.address.current.country;
			this.librariesSvc.registerAsync(this.info.library, 
				(data: any) => {
					this.showAlert(
						"Đăng ký",
						"Thư viện đã được đăng ký thành công!",
						() => {
							this.initializeLibrary(data.Data.ID);
							this.cancelUpdate();
						}
					);
				},
				(error: any) => {
					this.showError(error);
				}
			);
		}
	}

	// update
	doUpdate(form: NgForm) {
		this.info.state.valid = this.isValidInfo(form);
		if (this.info.state.valid) {
			this.info.state.processing = true;
			this.info.library.Contact.County = this.info.address.current.county;
			this.info.library.Contact.Province = this.info.address.current.province;
			this.info.library.Contact.Country = this.info.address.current.country;
			this.uploadAvatar(() => {
				this.info.library.Avatar = this.info.avatar.uploaded != ""
				? this.info.avatar.uploaded
				: "";
				this.librariesSvc.updateAsync(this.info.library,
					() => {
						this.initializeLibrary(this.info.library.ID);
						this.cancelUpdate();
					},
					(error: any) => {
						this.showError(error);
					}
				);
			});
		}
	}

	uploadAvatar(onCompleted?: () => void) {
		if (this.cropper.data.image != "" && this.cropper.data.image != this.info.avatar.current) {
			this.http.post(
				AppData.Configuration.app.uris.files + "libraries/avatar",
				JSON.stringify({ "Data": this.cropper.data.image }),
				{
					headers: AppAPI.getHeaders({
						"content-type": "application/json",
						"x-as-base64": "yes",
						"x-vieapps-lib-id": this.info.library.ID
					})
				}
			)
			.map(response => response.json())
			.subscribe(
				(data: any) => {
					this.info.avatar.uploaded = data.Uri;
					this.cropper.data = {
						image: data.Uri,
						original: undefined
					};
					onCompleted && onCompleted();
				},
				(error: any) => {
					console.error("Error occurred while uploading avatar image", error);
					onCompleted && onCompleted();
				}
			);
		}
		else {
			onCompleted && onCompleted();
		}
	}
	
	changeAvatar(event: any) {
		var image = new Image();
    var file = event.target.files[0];
    var reader = new FileReader();
    reader.onloadend = (loadEvent: any) => {
			image.src = loadEvent.target.result;
			this.cropperCtrl.setImage(image);
    };
		reader.readAsDataURL(file);
	}

	doSetPrivileges() {
		var info = {
			ID: this.info.library.ID,
			Administrators: new List<AppModels.Account>(this.privileges.edit.Administrators)
				.Select(a => a.ID)
				.ToArray(),
			Moderators: new List<AppModels.Account>(this.privileges.edit.Moderators)
				.Select(a => a.ID)
				.ToArray()
		};
		this.info.state.processing = true;
		this.librariesSvc.updatePrivilegesAsync(info,
			(data: any) => {
				this.initializeLibrary(this.info.library.ID);
				this.cancelUpdate();
			},
			(error: any) => {
				this.showError(error);
			}
		);
	}

	// open page to add a book
	doAddBook() {
		this.navCtrl.push(AddBookPage, { LibraryID: this.info.library.ID });
	}

}