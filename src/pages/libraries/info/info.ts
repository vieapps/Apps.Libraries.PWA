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
	privileges = { 
		current: undefined as AppModels.Privileges,
		edit: {
			Processing: "",
			Owner: undefined as AppModels.Account,
			Administrators: undefined as Array<AppModels.Account>,
			Moderators: undefined as Array<AppModels.Account>
		}
	};
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
				if (this.info.library && this.info.library.ID == info.args.ID) {
					this.prepare(info.args.ID);
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
			this.prepare(this.navParams.get("ID"));
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

	prepare(id: string) {
		let library = AppData.Libraries.getValue(id);

		this.info.library = AppUtility.clone(library, ["Privileges", "Counters", "RatingPoints", "Stocks", "Books"]);
		this.privileges.current = library.Privileges;

		this.info.title = "Thư viện: " + library.Title;
		this.info.avatar.current = AppUtility.getAvatarImage(library);
		this.info.rating = library.RatingPoints && library.RatingPoints.containsKey("General")
			? library.RatingPoints.getValue("General").Average
			: 0;

		if (!library.Books) {
			this.librariesSvc.getBooks(library.ID);
		}
	}

	// event handlers
	showActions() {
		var actionSheet = this.actionSheetCtrl.create({
			enableBackdropDismiss: true
		});

		if (this.canModerate()) {
			actionSheet.addButton({
				text: "Xử lý yêu cầu mượn/trả",
				icon: this.info.isAppleOS ? undefined : "analytics",
				handler: () => {
					this.openTransactions();					
				}
			});
		}

		if (this.canManage()) {
			actionSheet.addButton({
				text: "Cập nhật",
				icon: this.info.isAppleOS ? undefined : "create",
				handler: () => {
					this.openUpdate();
				}
			});
		}

		if (this.canManage() || this.authSvc.isAdministrator()) {
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

		if (AppData.Accounts.containsKey(this.info.library.OwnerID)) {
			this.privileges.edit.Owner = AppData.Accounts.getValue(this.info.library.OwnerID);
		}
		else {
			this.authSvc.getProfileAsync(true, this.info.library.OwnerID, () => {
				this.privileges.edit.Owner = AppData.Accounts.getValue(this.info.library.OwnerID);
			});
		}

		new List(this.privileges.current ? this.privileges.current.AdministrativeUsers.toArray() : [])
			.ForEach(id => {
				if (AppData.Accounts.containsKey(id)) {
					this.privileges.edit.Administrators.push(AppData.Accounts.getValue(id));
				}
				else {
					this.authSvc.getProfileAsync(true, id, () => {
						this.privileges.edit.Administrators.push(AppData.Accounts.getValue(id));
					});
				}
			});
		
		new List(this.privileges.current ? this.privileges.current.ModerateUsers.toArray() : [])
			.ForEach(id => {
				if (AppData.Accounts.containsKey(id)) {
					this.privileges.edit.Moderators.push(AppData.Accounts.getValue(id));
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
		if (mode == "Administrator") {
			this.privileges.edit.Administrators
				= new List(this.privileges.edit.Administrators).Where(a => a.ID != id).ToArray();
		}
		else {
			this.privileges.edit.Moderators
				= new List(this.privileges.edit.Moderators).Where(a => a.ID != id).ToArray();
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

	canManage(includeSystemAdministrator?: boolean) {
		return this.info.library
			? this.info.library.OwnerID == AppData.Configuration.session.account.id
				|| this.authSvc.canManage(undefined, undefined, this.privileges.current)
			: false;
	}

	canModerate() {
		return this.info.library
			? this.canManage() || this.authSvc.canModerate(undefined, undefined, this.privileges.current)
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
	register(form: NgForm) {
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
							this.prepare(data.Data.ID);
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
	update(form: NgForm) {
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
						this.prepare(this.info.library.ID);
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

	// update privileges
	setPrivileges() {
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
				this.prepare(this.info.library.ID);
				this.cancelUpdate();
			},
			(error: any) => {
				this.showError(error);
			}
		);
	}

	// add a book
	addBook() {
		this.navCtrl.push(AddBookPage, { LibraryID: this.info.library.ID });
	}

	// process the transactions
	openTransactions() {

	}

}